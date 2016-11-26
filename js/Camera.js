function Camera(type) {
    this.matrix = mat4();
    this.up = vec3();
    this.right = vec3();
    this.normal = vec3();
    this.home = vec3();
    this.azimuth = 0.0;
    this.elevation = 0.0;
    this.type = type;
    this.steps = 0;
    this.hookRenderer = null;
    this.hookGUIUpdate = null;
}

Camera.prototype.setType = function(t) {
    this.type = t;
    if (t != CAMERA_ORBIT_TYPE && t != CAMERA_TRACKING_TYPE) {
	alert('Wrong Camera Type!. Setting Orbitting type by default');
	this.type = CAMERA_ORBIT_TYPE;
    }
};

Camera.prototype.goHome = function(h) {
    if (h != null) {
	this.home = h;
    }
    this.setPosition(this.home);
    this.setAzimuth(0);
    this.setElevation(0);
    this.steps = 0;
};

Camera.prototype.dolly = function(s) {
    var c = this;
    var p = vec3();
    var n = vec3();
    p = c.position;
    var step = s - c.steps;
    n = normalize(c.normal);
    var newPosition = vec3();
    if (c.type == CAMERA_TRACKING_TYPE) {
	newPosition[0] = p[0] - step * n[0];
	newPosition[1] = p[1] - step * n[1];
	newPosition[2] = p[2] - step * n[2];
    } else {
	newPosition[0] = p[0];
	newPosition[1] = p[1];
	newPosition[2] = p[2] - step;
    }
    c.setPosition(newPosition);
    c.steps = s;
};

Camera.prototype.setPosition = function(p) {
    this.position = vec3(p);
    this.update();
};

Camera.prototype.setAzimuth = function(az) {
    this.changeAzimuth(az - this.azimuth);
};

Camera.prototype.changeAzimuth = function(az) {
    var c = this;
    c.azimuth += az;
    if (c.azimuth > 360 || c.azimuth <-360) {
	c.azimuth = c.azimuth % 360;
    }
    c.update();
};

Camera.prototype.setElevation = function(el) {
    this.changeElevation(el - this.elevation);
};

Camera.prototype.changeElevation = function(el) {
    var c = this;
    c.elevation += el;
    if (c.elevation > 360 || c.elevation <-360) {
	c.elevation = c.elevation % 360;
    }
    c.update();
};

Camera.prototype.update = function() {
    if (this.type == CAMERA_TRACKING_TYPE) {
	var I = mat4();
	var T = translate(this.position[0], this.position[1], this.position[2]);
	var RY = rotate(this.azimuth, [0, 1, 0]);
	var RX = rotate(this.elevation, [1, 0, 0]);
	this.matrix = mat4_inverse(mult(mult(mult(I, RX), RY), T));
    } else {
	I = mat4();
	RY = rotate(this.azimuth, [0, 1, 0]);
	RX = rotate(this.elevation, [1, 0, 0]);
	T = translate(this.position[0], this.position[1], this.position[2]);
	this.matrix = mat4_inverse(mult(mult(mult(I, T), RX), RY));
    }

    var m = this.matrix;
    this.right = vec3(mat4_multiplyVec4(m, [1, 0, 0, 0]));
    this.up = vec3(mat4_multiplyVec4(m, [0, 1, 0, 0], this.up));
    this.normal = vec3(mat4_multiplyVec4(m, [0, 0, 1, 0], this.normal));

    if (this.type == CAMERA_TRACKING_TYPE) {
	this.position = vec3(mat4_multiplyVec4(m, [0, 0, 0, 1], this.position));
    }

    if (this.hookRenderer) {
	this.hookRenderer();
    }
    if (this.hookGUIUpdate) {
	this.hookGUIUpdate();
    }
};

Camera.prototype.getViewTransform = function() {
    // var m = mat4(this.matrix[0], this.matrix[1], this.matrix[2], this.matrix[3]);
    var m = mat4_inverse(this.matrix);
    return m;
};
