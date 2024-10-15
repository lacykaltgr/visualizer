/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DoubleSide, Group, MeshBasicMaterial } from 'three';
import { GlobalComponent, gltfLoader } from './global';

import { ARButton } from 'ratk';
import { PCDLoader } from 'three/addons/loaders/PCDLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { FirstPersonControls } from 'three/addons/controls/FirstPersonControls.js';
import { System } from 'elics';
import { prefabs } from './constants';
import { Potree } from '@pnext/three-loader';
import { loadPointCloud } from './sneaker';
import { MapControls } from 'three/examples/jsm/controls/MapControls.js';
import { Color } from 'three';



const CAMERA_ANGULAR_SPEED = Math.PI / 2;
const ORBIT_CONTROL_POLAR_ANGLE = 1.0831800840797905;



export class InlineSystem extends System {
	init() {
		this.needsSetup = true;
		this.pointCloud = null;
		this.controls = null;
		this.graphNeedsSetup = true;
	}

	_setupButtons(renderer) {
		const arButton = document.getElementById('ar-button');
		const webLaunchButton = document.getElementById('web-launch-button');
		webLaunchButton.style.display = 'none';
		ARButton.convertToARButton(arButton, renderer, {
			ENTER_XR_TEXT: 'Customize in MR',
			requiredFeatures: [
				'hit-test',
				'plane-detection',
				'mesh-detection',
				'anchors',
			],
			optionalFeatures: ['local-floor', 'bounded-floor', 'layers'],
			onUnsupported: () => {
				arButton.style.display = 'none';
				webLaunchButton.style.display = 'block';
			},
		});
		webLaunchButton.onclick = () => {
			window.open(
				'https://www.oculus.com/open_url/?url=' +
					encodeURIComponent(window.location.href),
			);
		};
	}

	update() {
		const { scene, camera, renderer} =
			this.getEntities(this.queries.global)[0].getComponent(GlobalComponent);

		if (this.needsSetup) {
			this._setupButtons(renderer);
			this.needsSetup = false;
			
			this.container = new Group();
			//gltfLoader.load('assets/gltf/shadow.gltf', (gltf) => {
			//	gltf.scene.children.forEach((node) => {
			//		const newMat = new MeshBasicMaterial({
			//			map: node.material.map,
			//			side: DoubleSide,
			//		});
			//		node.material = newMat;
			//	});

			//	this.container.add(gltf.scene);
			//});

			scene.add(this.container);
			this.pointCloud = loadPointCloud(null, null);
			this.container.add(this.pointCloud.container);
			this.container.add(this.pointCloud.graphContainer);
			this.container.add(this.pointCloud.objectContainer);

			this.container.position.set(-30, -5, -30);


			//const pointsClone = meshMap.clone();
			//const sneakerLeftClone = sneakerLeft.createCopy();
			//sneakerLeftClone.rotateZ(-Math.PI / 12);
			//const sneakerRightClone = sneakerRight.createCopy();
			//sneakerRightClone.rotateZ(-Math.PI / 12);
			//this.container.add(sneakerLeftClone, sneakerRightClone, pointsClone);
			//this.container.add(pointsClone);


			scene.add(this.container);

			document.getElementById('toggle-graph-button').addEventListener('click', this.pointCloud.toggleGraph);
			document.getElementById('toggle-map-button').addEventListener('click', this.pointCloud.toggleMap);
			document.getElementById('toggle-objects-button').addEventListener('click', this.pointCloud.toggleObjects);

			// add multi line comment
			/*
			this.orbitControls = new OrbitControls(camera, renderer.domElement);
			this.orbitControls.target.set(0, 0.05, 0);
			this.orbitControls.update();
			this.orbitControls.enableZoom = false;
			this.orbitControls.enablePan = false;
			this.orbitControls.enableDamping = true;
			this.orbitControls.autoRotate = true;
			this.orbitControls.rotateSpeed *= -0.5;
			this.orbitControls.autoRotateSpeed = CAMERA_ANGULAR_SPEED;
			this.orbitControls.minPolarAngle = ORBIT_CONTROL_POLAR_ANGLE;
			this.orbitControls.maxPolarAngle = ORBIT_CONTROL_POLAR_ANGLE;
			*/
			camera.position.set(0, 0.2, 0.3);

			this.controls = new MapControls( camera, renderer.domElement );
			//this.controls.enableDamping = true;
			this.controls.movementSpeed = 5;
			this.controls.lookSpeed = 0.1;

			scene.background = new Color( 0x222222 );

			renderer.xr.addEventListener('sessionstart', () => {
				this.container.visible = false;
				// scene.background transparent
				scene.background = null;
			});

			renderer.xr.addEventListener('sessionend', () => {
				this.container.visible = true;
				camera.position.set(0, 0.2, 0.3);
				scene.background = new Color( 0x222222 );
			});
			return;
		}

		if (this.container.visible) {
			//this.orbitControls.update();
			this.controls.update();
			this.pointCloud.update(camera, renderer);
		}
	}
	
}

InlineSystem.queries = {
	global: { required: [GlobalComponent] },
};

