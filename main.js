// create scene and camera
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xffffff);
const axisLength = 5;
scene.add(new THREE.AxisHelper(axisLength));

const field_of_view = 75;
const aspect_ratio = window.innerWidth / window.innerHeight;
const near = 0.1, far = 1000;
const camera = new THREE.PerspectiveCamera(field_of_view, aspect_ratio, near, far);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const distance = 10;
// camera.position.z = distance; // is assigned when camera mode is set up


// start rendering
function animate() {
	requestAnimationFrame(animate);
	renderer.render(scene, camera);
}
animate();


// wrapper to notify listeners when object is updated
function Observable() {
	let object = null;
	const listeners = [];

	this.addListener = function (listener) {
		if (object !== null) {
			listener(object);
		}
		listener.object = object;
		listeners.push(listener);
	};

	this.set = function (obj) {
		object = obj;
		for (let listener of listeners) {
			if (listener.object !== object) {
				listener(object);
				listener.object = object;
			}
		}
	};
}



// 3d object which will be moved, rotated and rendered
const object = new Observable();


const defaultMaterial = new THREE.MeshNormalMaterial();


// set up and add to scene
object.addListener(function (object) {
	let old = scene.getObjectByName('current');
	if (old !== undefined) {
		object.position.copy(old.position);
		object.quaternion.copy(old.quaternion);
		scene.remove(old);
	}

	object.name = 'current';

	object.traverse(function (child) {
		if (child instanceof THREE.Mesh) {
			child.material = defaultMaterial;
		}
	});

	// fit to the scene
	if (!object.doNotScale) {
		var bb = new THREE.Box3().setFromObject(object);
		var width = bb.max.x - bb.min.x;
		var height = bb.max.y - bb.min.y;
		var depth = bb.max.z - bb.min.z;
		var max = Math.max(Math.max(width, height), depth);
		var k = 6 / max;
		object.scale.set(k, k, k);
	}

	scene.add(object);
});


const fileStatus = document.getElementById('file-status');

function loadObject(url) {
	new THREE.OBJLoader().load(url,
		function (obj) {
			fileStatus.innerHTML = '';
			object.set(obj);
		},
		function (progress) {
			fileStatus.innerHTML = Math.round(progress.loaded / progress.total * 100) + '%';
		},
		function (error) {
			fileStatus.innerHTML = 'Ошибка';
		});
}


const fileUrl = new URL(window.location.href).searchParams.get("file");

if (fileUrl) {
	loadObject(fileUrl);
} else {
	var geometry = new THREE.BoxGeometry(2, 2, 2);
	var cube = new THREE.Mesh(geometry, defaultMaterial);
	cube.doNotScale = true;
	object.set(cube);
}


// allow user upload local files
document.getElementById('file-input')
	.addEventListener('change', function (e) {
		let file = e.target.files[0];
		if (!file) return;
		let url = URL.createObjectURL(file);
		loadObject(url);
	}, false);


const app = angular.module('app', []);


app.controller('camera', function ($scope) {
	$scope.items = [{
		label: 'z',
		set: () => {
			camera.position.set(0, 0, distance);
			camera.up = new THREE.Vector3(0, 1, 0);
			camera.lookAt(new THREE.Vector3(0, 0, 0));
		}
	}, {
		label: 'y',
		set: () => {
			camera.position.set(0, distance, 0);
			camera.up = new THREE.Vector3(-1, 0, 0);
			camera.lookAt(new THREE.Vector3(0, 0, 0));
		}
	}, {
		label: 'x',
		set: () => {
			camera.position.set(distance, 0, 0);
			camera.up = new THREE.Vector3(0, 1, 0);
			camera.lookAt(new THREE.Vector3(0, 0, 0));
		}
	}, {
		label: 'xyz',
		set: () => {
			const d = distance / Math.sqrt(3);
			camera.position.set(d, d, d);
			camera.up = new THREE.Vector3(0, 1, 0);
			camera.lookAt(new THREE.Vector3(0, 0, 0));
		}
	}];
	$scope.selected = $scope.items[0];
	$scope.update = () => $scope.selected.set();
});


app.controller('angles', function ($scope) {
	$scope.angles = {
		x: { name: 'α', info: 'Угол поворота вокруг оси Ox' },
		y: { name: 'β', info: '' },
		z: { name: 'γ', info: '' },
	};
	$scope.angle_min = -Math.PI;
	$scope.angle_max = +Math.PI;
	object.addListener(function (object) {
		$scope.rotation = object.rotation;
	});
});

app.controller('position', function ($scope) {
	$scope.pos_min = -4;
	$scope.pos_max = +4;
	object.addListener(function (object) {
		$scope.position = object.position;
	});
});

app.controller('quaternion', function ($scope) {
	$scope.values = {
		x: { name: 'a', default: 0, info: 'Поворота вокруг оси Ox' },
		y: { name: 'b', default: 0, info: '' },
		z: { name: 'c', default: 0, info: '' },
		w: { name: 'd', default: 1, info: '' },
	};
	$scope.value_min = -1;
	$scope.value_max = +1;
	$scope.quaternion = { x: 0, y: 0, z: 0, w: 1 };
	object.addListener(function (object) {
		$scope.quaternion = object.quaternion;
	});
	$scope.isNormalized = function () {
		if ($scope.quaternion.lengthSq === undefined) return true;
		const l2 = $scope.quaternion.lengthSq();
		return Math.abs(l2 - 1) < 1e-6;
	}
	const props = Object.keys($scope.values).map(i => `quaternion.${i}`);
	props.push('keepNormalized');
	$scope.$watchGroup(props, function () {
		if ($scope.keepNormalized && !$scope.isNormalized()) {
			$scope.quaternion.normalize();
		}
	});
});


THREE.Object3D.prototype.rotateAroundWorldAxis = function (point, axis, angle) {
	const q = new THREE.Quaternion();
	q.setFromAxisAngle(axis.normalize(), angle);

	this.applyQuaternion(q);

	this.position.sub(point);
	this.position.applyQuaternion(q);
	this.position.add(point);

	return this;
};


app.controller("axis_and_angle", function ($scope) {
	$scope.point = new THREE.Vector3();
	$scope.point_min = -5;
	$scope.point_max = +5;

	$scope.vector = new THREE.Vector3();
	$scope.vector_min = -1;
	$scope.vector_max = +1;

	$scope.angle_min = -Math.PI;
	$scope.angle_max = +Math.PI;

	object.addListener(function (object) {
		$scope.object = object;
	});

	$scope.rotate = function () {
		if ($scope.object === undefined) return;
		$scope.object.rotateAroundWorldAxis($scope.point, $scope.vector, $scope.angle);
		// quaternionScope.$apply(); // if rotated outside from angular
		$scope.point = new THREE.Vector3();
		$scope.vector = new THREE.Vector3();
		$scope.angle = 0;
	}

	// add arrow starts in given point directed by given vector
	const arrowHelper = new THREE.ArrowHelper($scope.vector, $scope.point, 3, 0x000000);
	scene.add(arrowHelper);
	$scope.$watchGroup(['point.x', 'point.y', 'point.z', 'vector.x', 'vector.y', 'vector.z'], function () {
		arrowHelper.visible = $scope.vector.lengthSq() > 0;
		arrowHelper.position.copy($scope.point);
		arrowHelper.setDirection($scope.vector.clone().normalize());
	});
});
