/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
	Group,
	Mesh,
	MeshBasicMaterial,
	MeshStandardMaterial,
	PlaneGeometry,
	SRGBColorSpace,
} from 'three';
import {
	LeatherMaterials,
	SHOE_PART_CONFIG_OPTIONS,
	prefabs,
} from './constants';
import { gltfLoader, textureLoader } from './global';
import { PCDLoader } from 'three/addons/loaders/PCDLoader.js';

import { GrabComponent } from './grab';
import { Text } from 'troika-three-text';
import { Potree } from '@pnext/three-loader';
import { Vector3, Box3, Color, BufferGeometry, LineSegments, LineBasicMaterial, Float32BufferAttribute, TextureLoader, PointsMaterial, Points } from 'three';
import ROSLIB from 'roslib';

const CONFIG_PANEL_TEXTURE = textureLoader.load('assets/color_picker_ui.png');
CONFIG_PANEL_TEXTURE.colorSpace = SRGBColorSpace;



export const loadPointCloud = (world, global) => {
	const pointCloud = new PointCloud();
	pointCloud.loadPointCloud(global, world);
	return pointCloud;
}

export class PointCloud {
	constructor() {
		this.potree = new Potree('v2');
		this.potree.pointBudget = 3_000_000;
		this.pointClouds = [];
		this.baseUrl = "data19/potree/";

		this.container = new Group();
		this.mapVisible = true;
		this.toggleMap = this.toggleMap.bind(this);
		
		this.objectContainer = new Group();
		this.objectVisible = true;
		this.toggleObjects = this.toggleObjects.bind(this);

		this.graphContainer = new Group();
		this.graphVisible = true;
		this.toggleGraph = this.toggleGraph.bind(this);

		this.ros = new ROSLIB.Ros();
		this.setupROS();
		this.listener = new ROSLIB.Topic({
			ros : this.ros,
			name : '/listener',
			messageType : 'std_msgs/String'
		});
		this.listener.subscribe(function(message) {
			console.log('Received message on ' + this.listener.name + ': ' + message.data);
		});
	}

	setupROS() {
		this.ros.on('error', function(error) {
			document.getElementById('connecting').style.display = 'none';
			document.getElementById('connected').style.display = 'none';
			document.getElementById('closed').style.display = 'none';
			document.getElementById('error').style.display = 'inline';
			console.log(error);
		});

		// Find out exactly when we made a connection.
		this.ros.on('connection', function() {
			console.log('Connection made!');
			document.getElementById('connecting').style.display = 'none';
			document.getElementById('error').style.display = 'none';
			document.getElementById('closed').style.display = 'none';
			document.getElementById('connected').style.display = 'inline';
		});

		this.ros.on('close', function() {
			console.log('Connection closed.');
			document.getElementById('connecting').style.display = 'none';
			document.getElementById('connected').style.display = 'none';
			document.getElementById('closed').style.display = 'inline';
		});

		this.ros.connect('wss://10.88.164.22:9090');
	}


	loadPointCloud(global, world) {
		this.potree
		.loadPointCloud(
			// The name of the point cloud which is to be loaded.
			'metadata.json',
			// Given the relative URL of a file, should return a full URL (e.g. signed).
			relativeUrl => `${this.baseUrl}${relativeUrl}`,
		)
		.then(pco => {
			pco.material.size = 2.0;
			pco.rotateX(-Math.PI / 2);
			pco.rotateZ(-Math.PI/ 2);
			//pco.scale.set(.0, 10.0, 10.0);
			pco.position.set(0.0, 0.0, 0.0);
			this.pointClouds.push(pco);
			this.container.add(pco);
			if (global != null)
				global.pointcloud = this
				//global.pointcloud.grabComponent = world
				//	.createEntity()
				//	.addComponent(GrabComponent, { object3D: global.pointcloud.container });
		});

		this.loadConnections('data19/adjacency_matrix.txt');
		this.loadPCD('data19/nodes_demo.pcd');
		this.loadObj('data19/obj_merged.pcd');
	}

	update(camera, renderer) {
		this.potree.updatePointClouds(this.pointClouds, camera, renderer);
	}

	createCopy() {
		return this.container.clone();
	}


	loadPCD(filePath) {
		const loader = new PCDLoader();
		loader.load(filePath, (pcd) => {
			// Get the position attribute from geometry
			const positions = pcd.geometry.getAttribute('position');
			
			// Extract coordinates and add to this.coordinates
			this.coordinates = [];
			for (let i = 0; i < positions.count; i++) {
				this.coordinates.push({
					x: positions.getX(i),
					y: positions.getY(i),
					z: positions.getZ(i)
				});
			}
	
			// Apply transforms
			pcd.geometry.center();
			pcd.rotateX(-Math.PI / 2);
			pcd.rotateZ(-Math.PI / 2);
			// Set position to container's center instead of hardcoded values
			pcd.position.set(43.8, 2, 15.8);
	
			const sprite = new TextureLoader().load('assets/disc.png');
			sprite.colorSpace = SRGBColorSpace;
			const material = new PointsMaterial({ 
				size: 0.5, 
				sizeAttenuation: true, 
				map: sprite, 
				alphaTest: 0.8, 
				transparent: true 
			});
			material.color.setHSL(1.0, 0.3, 1.0, SRGBColorSpace);
	
			pcd.material = material;
	
			console.log('pcd loaded');
			this.graphContainer.add(pcd);
			this.nodesReady = true;
		});
	}

	loadConnections(filePath) {
		fetch(filePath)
			.then(response => response.text())
			.then(data => {
				const lines = data.trim().split('\n');
				const points = [];
				const lineIndices = [];
				
				// Parse adjacency matrix
				const adjacencyMatrix = lines.map(line => 
					line.trim().split(/\s+/).map(Number)
				);
				
				let connectionCount = 0;
				// Create connections based on adjacency matrix
				for (let i = 0; i < adjacencyMatrix.length; i++) {
					for (let j = i + 1; j < adjacencyMatrix[i].length; j++) {
						// If there's a connection (value is 1)
						if (adjacencyMatrix[i][j] === 1) {
							connectionCount++;
							// Get positions from this.coordinates
							const point1 = this.coordinates[i];
							const point2 = this.coordinates[j];
							
							// Add positions to points array
							points.push(
								point1.x, point1.y, point1.z,
								point2.x, point2.y, point2.z
							);
							
							// Add indices for the line
							const index = lineIndices.length / 2;
							lineIndices.push(index * 2, index * 2 + 1);
						}
					}
				}
	
				console.log(`Total number of connections: ${connectionCount}`);
				console.log(`Number of points in coordinates: ${this.coordinates.length}`);
				console.log(`Adjacency matrix size: ${adjacencyMatrix.length}x${adjacencyMatrix[0].length}`);
	
				const geometry = new BufferGeometry();
				geometry.setAttribute('position', new Float32BufferAttribute(points, 3));
				geometry.setIndex(lineIndices);
	
				const material = new LineBasicMaterial({ color: 0xff0000, linewidth: 300 });
				const lineSegments = new LineSegments(geometry, material);
	
				console.log('connections loaded');
	
				lineSegments.position.set(44.0, 2.0, 15.8);
				lineSegments.rotateX(-Math.PI / 2);
				lineSegments.rotateZ(-Math.PI / 2);
				lineSegments.geometry.center();
				this.graphContainer.add(lineSegments);
				this.connectionsReady = true;
			})
			.catch(error => console.error('Error loading connections:', error));
	}

	loadObj(filePath) {
		const loader = new PCDLoader();
		loader.load(filePath, (pcd) => {
			pcd.geometry.center();
			//pcd.material.size = 0.5;
			pcd.rotateX(-Math.PI / 2);
			pcd.rotateZ(-Math.PI/ 2);
			pcd.material.size = 0.25;
			//pco.scale.set(.0, 10.0, 10.0);
			pcd.position.set(42.85, 2.5, 15.8);
			// set color to red

			console.log('obj pcd loaded');
			this.objectContainer.add(pcd);
		});
	}

	toggleMap() {
		if (this.container.children.length > 0) {
			this.mapVisible = !this.mapVisible;
			this.container.visible = this.mapVisible;
		}
	}

	toggleObjects() {
		if (this.objectContainer.children.length > 0) {
			this.objectVisible = !this.objectVisible;
			if (this.objectVisible) {
				this.animatePointSize(0.0, 0.25, 1500); // Animate from 0 to 0.25 over 1 second
			} else {
				this.animatePointSize(0.25, -0.1, 1500); // Animate from 0.25 to 0 over 1 second
			}
			this.objectContainer.visible = true; // Keep it visible while animating
		}
	}
	
	animatePointSize(startSize, endSize, duration) {
		const startTime = performance.now();
	
		// Ease-out cubic function
		const easeOutCubic = (t) => (--t) * t * t + 1;
	
		const animate = () => {
			const elapsedTime = performance.now() - startTime;
			const progress = Math.min(elapsedTime / duration, 1); // Clamp to 1 for completion
	
			// Apply the easing function
			const easedProgress = easeOutCubic(progress);
			const currentSize = startSize + (endSize - startSize) * easedProgress;
	
			// Update all point materials in the objectContainer
			this.objectContainer.children.forEach((object) => {
				if (object.material && object.material.size !== undefined) {
					object.material.size = currentSize;
					object.material.needsUpdate = true;
				}
			});
	
			if (progress < 1) {
				requestAnimationFrame(animate); // Continue animation
			} else if (!this.objectVisible) {
				this.objectContainer.visible = false; // Hide after animation completes
			}
		};
		animate();
	}


	toggleGraph() {
		if (this.graphContainer.children.length > 0) {
			this.graphVisible = !this.graphVisible;
	
			const duration = 4000; // Duration in milliseconds
			const startTime = performance.now();
	
			const animateElements = () => {
				const currentTime = performance.now();
				const elapsedTime = currentTime - startTime;
				const progress = Math.min(elapsedTime / duration, 1);
	
				// Update line drawing progress and node visibility
				this.graphContainer.children.forEach((element) => {
					if (element instanceof LineSegments && element.geometry) {
						const positions = element.geometry.attributes.position.array;
	
						// Animate the line drawing effect
						const totalSegments = positions.length / 3; // Number of points/vertices
						const visibleSegments = Math.floor(totalSegments * progress);
						for (let i = 0; i < totalSegments; i++) {
							if (i < visibleSegments) {
								element.geometry.attributes.position.array[i * 3 + 2] = 0; // Set Z to visible
							} else {
								element.geometry.attributes.position.array[i * 3 + 2] = 1000; // Move Z out of view
							}
						}
	
						element.geometry.attributes.position.needsUpdate = true; // Notify Three.js that the position buffer has changed
					} else if (element instanceof Points) {
						// Animate node visibility
						const positions = element.geometry.attributes.position.array;
						const totalNodes = positions.length / 3;
						const visibleNodes = Math.floor(totalNodes * progress);
	
						for (let i = 0; i < totalNodes; i++) {
							if (i < visibleNodes) {
								element.geometry.attributes.position.array[i * 3 + 2] = 0; // Set Z to visible
							} else {
								element.geometry.attributes.position.array[i * 3 + 2] = 1000; // Move Z out of view
							}
						}
	
						element.geometry.attributes.position.needsUpdate = true;
					}
				});
	
				// Continue the animation until complete
				if (progress < 1) {
					requestAnimationFrame(animateElements);
				} else {
					// When finished, if connections are hidden, set their visibility
					this.graphContainer.visible = this.graphVisible;
				}
			};
	
			// Start the animation
			if (this.graphVisible) {
				this.graphContainer.visible = true; // Make visible before starting animation
				animateElements();
			} else {
				// If hiding, set up reverse animation
				const startTime = performance.now();
				const fadeOut = () => {
					const currentTime = performance.now();
					const elapsedTime = currentTime - startTime;
					const progress = Math.min(elapsedTime / duration, 1);
	
					// Update line and node fading effect
					this.graphContainer.children.forEach((element) => {
						if ((element instanceof LineSegments || element instanceof Points) && element.geometry) {
							const positions = element.geometry.attributes.position.array;
	
							const totalElements = positions.length / 3; // Number of points/vertices
							const visibleElements = Math.floor(totalElements * (1 - progress));
							for (let i = 0; i < totalElements; i++) {
								if (i < visibleElements) {
									element.geometry.attributes.position.array[i * 3 + 2] = 0; // Set Z to visible
								} else {
									element.geometry.attributes.position.array[i * 3 + 2] = 1000; // Move Z out of view
								}
							}
	
							element.geometry.attributes.position.needsUpdate = true; // Notify Three.js that the position buffer has changed
						}
					});
	
					// Continue the animation until complete
					if (progress < 1) {
						requestAnimationFrame(fadeOut);
					} else {
						this.graphContainer.visible = false; // Hide after fading out
					}
				};
	
				// Start fade out animation
				fadeOut();
			}
		}
	}

}



export class Sneaker {
	constructor(sneakerMesh) {
		this._uiElements = { partName: null };

		this._sneakerObject = sneakerMesh;
		this._tongueMesh = null;
		this._backtabMesh = null;
		this._tongueLabels = [];
		this._backtabLabels = [];
		this._tongueLabelBackings = [];

		const uiRoot = new Group();

		const configPanel = new Mesh(
			new PlaneGeometry(0.3, 0.2025),
			new MeshBasicMaterial({
				color: 0xffffff,
				map: CONFIG_PANEL_TEXTURE,
				transparent: true,
			}),
		);
		uiRoot.add(configPanel);

		this._uiElements.partName = new Text();
		this._uiElements.partName.text = 'PartName';
		this._uiElements.partName.fontSize = 0.026;
		this._uiElements.partName.color = 0xffffff;
		this._uiElements.partName.anchorX = 'center';
		this._uiElements.partName.anchorY = 'middle';
		this._uiElements.partName.position.z = 0.001;
		this._uiElements.partName.position.y = 0.056;
		this._uiElements.partName.sync();
		configPanel.add(this._uiElements.partName);

		this._uiElements.colorName = new Text();
		this._uiElements.colorName.text = 'Color';
		this._uiElements.colorName.fontSize = 0.016;
		this._uiElements.colorName.color = 0xffffff;
		this._uiElements.colorName.anchorX = 'center';
		this._uiElements.colorName.anchorY = 'middle';
		this._uiElements.colorName.position.z = 0.001;
		this._uiElements.colorName.position.y = 0.0025;
		this._uiElements.colorName.sync();
		configPanel.add(this._uiElements.colorName);
		configPanel.position.set(0, 0.25, -0.2);

		const vamp = sneakerMesh.getObjectByName('vamp');

		this._uiElements.colorSwatches = [];
		gltfLoader.load('assets/swatch.glb', (gltf) => {
			const swatchTile = gltf.scene.getObjectByName('swatch_tile');
			this._selectionRing = gltf.scene.getObjectByName('swatch_ring');
			configPanel.add(this._selectionRing);
			this._selectionRing.visible = false;
			for (let j = 0; j < 2; ++j) {
				for (let i = 0; i < 6; ++i) {
					const swatch = new Mesh(
						swatchTile.geometry,
						new MeshStandardMaterial({
							color: 0xffffff,
							normalMap: vamp.material.normalMap,
						}),
					);
					swatch.position.x = -0.11 + 0.044 * i;

					const index = j * 6 + i;
					this.updateMaterial(swatch.material, LeatherMaterials[index]);
					swatch.material.roughness = 0.0;
					swatch.material.metalness = 0.1;
					swatch.name = 'color-swatch';
					swatch.userData.material_index = index;
					swatch.visible = false;

					this._uiElements.colorSwatches.push(swatch);
					configPanel.add(swatch);
				}
			}
		});

		this._shoeParts = {};
		this._intersectParts = [];

		Object.entries(SHOE_PART_CONFIG_OPTIONS).forEach(
			([partName, configOptions]) => {
				this._shoeParts[partName] = {
					primary: sneakerMesh.getObjectByName(partName),
				};
				this._intersectParts.push(this._shoeParts[partName].primary);
				if (configOptions.secondaryMaterials) {
					this._shoeParts[partName].secondary = sneakerMesh.getObjectByName(
						partName + '_secondary',
					);
					this._intersectParts.push(this._shoeParts[partName].secondary);
				}
				if (configOptions.stichingMaterials) {
					this._shoeParts[partName].stiching = sneakerMesh.getObjectByName(
						partName + '_stiching',
					);
				}
				Object.values(this._shoeParts[partName]).forEach((node) => {
					node.userData.colorIndex = 0;
					node.userData.key = partName;
					node.material.emissive.setHex(0xffffff);
					node.material.emissiveIntensity = 0;
				});
			},
		);

		sneakerMesh.traverse((child) => {
			if (child.isMesh) {
				child.userData.colorIndex = 0;
			}
		});

		this.setPrefab(prefabs.default);

		this._shoepartSelected = null;
		this._plane = uiRoot;
	}

	getShoeIntersect(raycaster) {
		this._intersectParts.forEach((part) => {
			part.material.emissiveIntensity = 0;
		});
		const intersect = raycaster.intersectObjects(this._intersectParts)[0];
		if (intersect) {
			intersect.object.material.emissiveIntensity = 0.1;
			return {
				partName: intersect.object.userData.key,
				distance: intersect.distance,
			};
		}
	}

	setPrefab(prefab) {
		Object.entries(prefab).forEach(([partName, materialConfig]) => {
			Object.entries(materialConfig).forEach(([materialKey, colorIndex]) => {
				this.updateShoePartMaterial(partName, materialKey, colorIndex);
			});
		});
	}

	updateShoePartMaterial(partName, materialKey, colorIndex) {
		const material = SHOE_PART_CONFIG_OPTIONS[partName].materials[colorIndex];
		const shoePart = this._shoeParts[partName][materialKey];
		shoePart.material.color = material.color;
		shoePart.material.roughness = material.roughness;
		shoePart.material.metalness = material.metalness;
		shoePart.material.name = material.name;
		shoePart.userData.colorIndex = colorIndex;
	}

	updateMaterial(dest, src) {
		dest.color = src.color;
		dest.roughness = src.roughness;
		dest.metalness = src.metalness;
		dest.name = src.name;
	}

	get uiPlane() {
		return this._plane;
	}

	get mesh() {
		return this._sneakerObject;
	}

	createCopy() {
		return this._sneakerObject.clone();
	}

	setShoePart(partName) {
		this._shoepartSelected = this._sneakerObject.getObjectByName(partName);
		this._uiElements.partName.text =
			SHOE_PART_CONFIG_OPTIONS[partName].displayName;
		this._uiElements.partName.sync();

		this._updateColorNameUI();
		this._updateColorSwatchesUI();
	}

	_updateColorNameUI() {
		let mesh;
		if (this._shoepartSelected.isMesh) {
			mesh = this._shoepartSelected;
		} else {
			this._shoepartSelected.traverse((child) => {
				if (child.isMesh) {
					mesh = child;
				}
			});
		}

		if (mesh !== undefined) {
			this._uiElements.colorName.text = mesh.material.name;
		} else {
			this._uiElements.colorName.text = 'Unknown';
		}
		this._uiElements.colorName.sync();
	}

	_updateColorSwatchesUI() {
		// Get a mesh so we can get the materials
		let mesh;
		if (this._shoepartSelected.isMesh) {
			mesh = this._shoepartSelected;
		} else {
			this._shoepartSelected.traverse((child) => {
				if (child.isMesh) {
					mesh = child;
				}
			});
		}

		this._selectionRing.visible = false;

		const configOptions = SHOE_PART_CONFIG_OPTIONS[mesh.userData.key];

		const bSingleRow = configOptions.materials.length == 6;
		for (let i = 0; i < this._uiElements.colorSwatches.length; ++i) {
			const swatch = this._uiElements.colorSwatches[i];
			if (i < configOptions.materials.length) {
				swatch.visible = true;
				swatch.position.z = 0;
				this.updateMaterial(swatch.material, configOptions.materials[i]);
				if (bSingleRow) {
					swatch.position.y = -0.052;
				} else {
					swatch.position.y = i > 5 ? -0.074 : -0.03;
				}
				if (i == mesh.userData.colorIndex) {
					this._selectionRing.position.copy(swatch.position);
					this._selectionRing.visible = true;
				}
			} else {
				swatch.position.z = -0.5;
				swatch.visible = false;
			}
		}
	}

	update(colorIndex, justClicked) {
		if (justClicked && this._shoepartSelected) {
			this._shoepartSelected.traverse((child) => {
				if (child.isMesh) {
					child.userData.colorIndex = colorIndex;
					const srcMat =
						SHOE_PART_CONFIG_OPTIONS[this._shoepartSelected.name].materials[
							colorIndex
						];
					if (srcMat) {
						this.updateMaterial(child.material, srcMat);
					}
				}
			});

			this._updateColorNameUI();
			this._updateColorSwatchesUI();
		}
	}
}
