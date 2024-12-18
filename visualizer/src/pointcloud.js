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
	SphereGeometry,
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
		this.baseUrl = "scene_data/potree/";

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

		this.tfListener = new ROSLIB.Topic({
			ros: this.ros,
			name: '/tf',
			messageType: 'tf2_msgs/msg/TFMessage',
		});
		this.tfListener.subscribe(this.updateSpherePosition.bind(this));

		this.reset = new ROSLIB.Topic({
			ros : this.ros,
			name : '/env/reset',
			messageType : 'std_msgs/String'
		});
		document.getElementById('reset-button').addEventListener('click', this.resetEnvironment.bind(this));

		this.query_pub = new ROSLIB.Topic({
			ros : this.ros,
			name : '/query',
			messageType : 'std_msgs/String'
		});
		document.getElementById('query-button-robot').addEventListener('click', this.query_robot.bind(this));
		this.query_pub_human = new ROSLIB.Topic({
			ros : this.ros,
			name : '/satinav_bridge_query',
			messageType : 'std_msgs/String'
		});
		document.getElementById('query-button-human').addEventListener('click', this.query_human.bind(this));


		this.result_sub = new ROSLIB.Topic({
			ros : this.ros,
			name : '/query_result',
			messageType : 'std_msgs/String'
		});
		this.result_sub.subscribe((message) => {
			console.log('Received result: ' + message.data);
			// convert data to json
			var json = JSON.parse(message.data);
			var results = {
				'node_id': json.node_id,
				'node_desciption': json.node_desciption,
				'target': json.target,
			}
			document.getElementById('result-display').innerText = JSON.stringify(results, null, 2);
			document.getElementById('result-display').style.display = 'block';
			document.getElementById('result-display').style.color = 'red';

			var path = json.path;
			this.updatePath(path);
		});

		this.spherePosition = new Vector3(0, 0, 0); // Initial sphere position
		this.greenSphere = this.createGreenSphere(); // Create the sphere
		this.container.add(this.greenSphere); // Add sphere to the container
		this.pathSegments = null;
	}

	resetEnvironment() {
		var message = new ROSLIB.Message({
			data: 'reset'
		});
		this.reset.publish(message);
		console.log('Resetting environment');
	}

	query_robot() {
		var message = document.getElementById('query-input').value;
		var query = new ROSLIB.Message({
			data: message
		});
		this.query_pub.publish(query);
		console.log('Querying environment');
	}

	query_human() {
		var query_string = document.getElementById('query-input').value;
		var message = JSON.stringify({
			agent_id: "satinav",
			query: query_string,
			geopose: {
				position: {
					lat: 47.48623767928393846,
					lon: 19.07939640241426105,
					h: 0.85
				},
				quaternion: {
					"x":0, "y":0, "z":0, "w":1
				}
			}
		});
		var query = new ROSLIB.Message({data: message});
		this.query_pub_human.publish(query);
		console.log('Querying environment');
	}

	setupROS() {
		this.ros.on('error', function(error) {
			console.log(error);
		});

		// Find out exactly when we made a connection.
		this.ros.on('connection', function() {
			console.log('Connection made!');
		});

		this.ros.on('close', function() {
			console.log('Connection closed.');
		});

		this.ros.connect('ws://10.88.164.22:9090');
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
			this.pointClouds.push(pco);
			this.container.add(pco);
			if (global != null)
				global.pointcloud = this
				//global.pointcloud.grabComponent = world
				//	.createEntity()
				//	.addComponent(GrabComponent, { object3D: global.pointcloud.container });
		});

		this.loadConnections('scene_data/adjacency_matrix.txt');
		this.loadPCD('scene_data/nodes.pcd');
		this.loadObj('scene_data/obj_merged.pcd');
	}

	update(camera, renderer) {
		this.potree.updatePointClouds(this.pointClouds, camera, renderer);
	}

	createCopy() {
		return this.container.clone();
	}

	createGreenSphere() {
		const geometry = new SphereGeometry(0.5, 32, 32);
		const material = new MeshBasicMaterial({ color: new Color(0x00ff00) });
		const sphere = new Mesh(geometry, material);
		sphere.geometry.center();
		sphere.position.copy(this.spherePosition); // Initialize position
		return sphere;
	}

	updateSpherePosition(message) {
		const translation = message.transforms[0].transform.translation;
		this.spherePosition.set(translation.y, translation.z, translation.x);
		this.greenSphere.geometry.center(); // Center the sphere
		this.greenSphere.position.copy(this.spherePosition); // Update sphere's position
		this.greenSphere.visible = true; // Ensure it's visible on update
	}

	updatePath(path) {
		if (this.pathSegments) {
			this.graphContainer.remove(this.pathSegments);
		}

		// Extract points
		const points = [];
		path.forEach((point) => {
			points.push(point.x, point.y, point.z);
		});
	
		// Generate line indices
		const lineIndices = [];
		for (let i = 0; i < path.length - 1; i++) {
			lineIndices.push(i, i + 1);
		}

		const geometry = new BufferGeometry();
		geometry.setAttribute('position', new Float32BufferAttribute(points, 3));
		geometry.setIndex(lineIndices);

		const material = new LineBasicMaterial({ color: 0x00ff00, linewidth: 100 });
		this.pathSegments = new LineSegments(geometry, material);
		this.container.add(this.pathSegments);
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
	
				this.graphContainer.add(lineSegments);
				this.connectionsReady = true;
			})
			.catch(error => console.error('Error loading connections:', error));
	}

	loadObj(filePath) {
		const loader = new PCDLoader();
		loader.load(filePath, (pcd) => {
			pcd.material.size = 0.25;
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



