/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { GlobalComponent, textureLoader } from './global';
import {
	Group,
	Mesh,
	MeshBasicMaterial,
	Object3D,
	PlaneGeometry,
	SRGBColorSpace,
} from 'three';

import { FollowComponent } from './follow';
import { PlayerComponent } from './player';
import { System } from 'elics';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { FirstPersonControls } from 'three/examples/jsm/controls/FirstPersonControls.js';

export class WelcomeSystem extends System {
	init() {
		this._welcomePanel = null;
		this._sneakerObjects = {
			left: null,
			right: null,
		};

		this._sneakersGroup = null;
		this._sneakersDetached = false;
	}

	update() {
		const global = this.getEntities(this.queries.global)[0].getComponent(
			GlobalComponent,
		);

		const player = this.getEntities(this.queries.player)[0].getComponent(
			PlayerComponent,
		);

		const { sneakerLeft, sneakerRight, pointcloud, camera, renderer } = global;


		if (!this._welcomePanel && sneakerLeft && sneakerRight && pointcloud) {
			const geometry = new PlaneGeometry(0.5, 0.12);
			const material = new MeshBasicMaterial({
				transparent: true,
			});
			textureLoader.load('assets/intro_panel.png', (texture) => {
				texture.colorSpace = SRGBColorSpace;
				material.map = texture;
			});
			const plane = new Mesh(geometry, material);
			this._welcomePanel = new Group();
			global.scene.add(this._welcomePanel);

			/*
			const uiAnchor = new Object3D();
			uiAnchor.position.set(0, 0, -0.5);
			player.head.add(uiAnchor);

			this.world.createEntity().addComponent(FollowComponent, {
				object3D: this._welcomePanel,
				followDistanceThreshold: 0.1,
				positionTarget: uiAnchor,
				lookatTarget: player.head,
			});
			console.log(this._welcomePanel);
			*/

			//sneakerLeft.mesh.position.set(-0.025, 0.039, -0.061);
			//sneakerRight.mesh.position.set(-0.025, 0.039, 0.061);
			// x: forward/backward, y: up/down, z: left/right
			pointcloud.container.position.set(-30, -5, -30);
			pointcloud.container.scale.set(0.8, 0.8, 0.8);

			//const sneakers = new Group().add(pointcloud.container);
			//sneakers.position.y = -0.25;
			//this._welcomePanel.add(pointcloud.container);
			this._welcomePanel.add(pointcloud.container);
			this._sneakersGroup = pointcloud.container;

			/*
			const CAMERA_ANGULAR_SPEED = Math.PI / 2;
			const ORBIT_CONTROL_POLAR_ANGLE = 1.0831800840797905;

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


		} 

		//this.orbitControls.update();

		if (this._welcomePanel) {
			let isAttached = false;
			Object.values(player.controllers).forEach((controllerObject) => {
				if (controllerObject.attached) {
					isAttached = true;
				}
			});
			if (isAttached && !this._sneakersDetached) {
				[...this._sneakersGroup.children].forEach((sneakerObject) => {
					global.scene.attach(sneakerObject);
				});
				this._sneakersDetached = true;
			}
			this._welcomePanel.visible =
				global.renderer.xr.isPresenting && !isAttached;
		}
	}
}

WelcomeSystem.queries = {
	global: { required: [GlobalComponent] },
	player: { required: [PlayerComponent] },
};
