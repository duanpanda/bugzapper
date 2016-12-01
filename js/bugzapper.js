var canvas;
var gl;
var prg;
const RADIAN_TO_DEGREE = 180 / Math.PI;
const DEGREE_TO_RADIAN = Math.PI / 180;

var numTimesToSubdivide = 5;
var updateLightPosition = false;

var near = 0.2;
var far = 5000;
var fovy = 90;

var va = vec4(0.0, 0.0, -1.0, 1.0);
var vb = vec4(0.0, 0.942809, 0.333333, 1.0);
var vc = vec4(-0.816497, -0.471405, 0.333333, 1.0);
var vd = vec4(0.816497, -0.471405, 0.333333, 1.0);

var lightPosition = vec4(0, 0.8, 0.8, 0.0);
var lightAmbient = vec4(0.2, 0.2, 0.2, 1.0);
var lightDiffuse = vec4(1.0, 1.0, 1.0, 1.0);
var lightSpecular = vec4(1.0, 1.0, 1.0, 1.0);
var sphereAmbient = vec4(1.0, 0.0, 1.0, 1.0);
var sphereDiffuse = vec4(1.0, 0.8, 0.0, 1.0);
var sphereSpecular = vec4(1.0, 0.8, 0.0, 1.0);
var sphereShininess = 100.0;
var capAmbient = vec4(1.0, 0.0, 0.0, 1.0);
var capDiffuse = vec4(1.0, 0.0, 0.0, 1.0);
var capSpecular = vec4(1.0, 0.0, 0.0, 1.0);
var capShininess = 200.0;

var transform;
var camera;
var interactor;

const CAMERA_ORBIT_TYPE = 1;
const CAMERA_TRACKING_TYPE = 2;

var capRadius = 1.02;
var maxNumCaps = 5;

var intervalId = 0;
var updateGameDelay = 80;
var isWin = false;
var isLost = false;
var gameTicks = 1;
var maxInterval = 30;
var nextTick = maxInterval;
var d_elevation = 0;
var d_azimuth = 0;
var animCount = 0;
const STD_ANIM_FRAMES = 60;
var animFrames = STD_ANIM_FRAMES;
var isAnimating = false;
var lockedCapIndex = -1;

var sphere = null;
var caps = [];

// Game Object Class
function GameObj() {
    this.vertices = [];
    this.normals = [];
    this.vbo = gl.createBuffer();
    this.ibo = null;
    this.nbo = gl.createBuffer();

    // visible parts
    this.beginVIndex = 0;
    this.vCount = this.vertices.length;

    // obj user can query isActive, but never set it, only set internally
    this.isActive = true;

    this.drawMode = gl.TRIANGLES;
    this.redraw = function() {
	gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
	gl.vertexAttribPointer(prg.aVertexPosition, 4, gl.FLOAT, false, 0, 0);
	gl.bindBuffer(gl.ARRAY_BUFFER, this.nbo);
	gl.vertexAttribPointer(prg.aVertexNormal, 4, gl.FLOAT, false, 0, 0);
	gl.drawArrays(this.drawMode, this.beginVIndex, this.vCount);
    };
    this.calcTransformMatrix = function(m) {
	return m;
    };
    this.setLights = function() {
    };
    this.update = function() {
    };
}


function addCap(obj) {
    caps.push(obj);
}

// Sphere
function Sphere() {
    GameObj.call(this);
    this.ambient = sphereAmbient;
    this.diffuse = sphereDiffuse;
    this.specular = sphereSpecular;
    this.shininess = sphereShininess;
    this.S = mat4();
    this.T = mat4();
    this.theta = 0;
    this.R = rotate(this.theta, [0, 1, 0]);

    this.triangle = function(a, b, c) {
	n1=vec4(a);
	n2=vec4(b);
	n3=vec4(c);
	n1[3]=0.0; n2[3]=0.0; n3[3]=0.0;
	this.normals.push(n1);
	this.normals.push(n2);
	this.normals.push(n3);
	this.vertices.push(a);
	this.vertices.push(b);
	this.vertices.push(c);
	this.vCount += 3;
    };
    this.divideTriangle = function(a, b, c, count) {
	if (count > 0) {
	    var ab = mix(a, b, 0.5);
	    var ac = mix(a, c, 0.5);
	    var bc = mix(b, c, 0.5);
	    ab = normalize(ab, true);
	    ac = normalize(ac, true);
	    bc = normalize(bc, true);
	    this.divideTriangle(a, ab, ac, count - 1);
	    this.divideTriangle(ab, b, bc, count - 1);
	    this.divideTriangle(bc, c, ac, count - 1);
	    this.divideTriangle(ab, bc, ac, count - 1);
	} else {
	    this.triangle(a, b, c);
	}
    };
    this.tetrahedron = function(a, b, c, d, n) {
	this.divideTriangle(a, b, c, n);
	this.divideTriangle(d, c, b, n);
	this.divideTriangle(a, d, b, n);
	this.divideTriangle(a, c, d, n);
    };
    this.genPoints = function() {
	this.vCount = 0;
	this.vertices = [];
	this.normals = [];
	this.tetrahedron(va, vb, vc, vd, numTimesToSubdivide);

	gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
	gl.bufferData(gl.ARRAY_BUFFER, flatten(this.vertices), gl.STATIC_DRAW);
	gl.bindBuffer(gl.ARRAY_BUFFER, this.nbo);
	gl.bufferData(gl.ARRAY_BUFFER, flatten(this.normals), gl.STATIC_DRAW);
    };
    this.genPoints();
    this.setLights = function() {
	gl.uniform4fv(prg.uMaterialAmbient, this.ambient);
	gl.uniform4fv(prg.uMaterialDiffuse, this.diffuse);
	gl.uniform4fv(prg.uMaterialSpecular, this.specular);
	gl.uniform1f(prg.uShininess, this.shininess);
    };
    this.calcTransformMatrix = function(m) {
	// in effect, scale first, rotate second, translate third, then apply
	// the global camera transformation m
	var a = mat4();		// identity
	a = mult(mult(mult(mult(a, m), this.T), this.R), this.S);
	return a;
    };
    this.update = function() {
    };
}

function configure() {
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.1, 0.1, 0.1, 1.0);
    gl.enable(gl.DEPTH_TEST);

    camera = new Camera(CAMERA_ORBIT_TYPE);
    camera.goHome([0.0, 0.0, 1.5]);

    interactor = new CameraInteractor(camera, canvas);

    transform = new SceneTransforms(camera);
    transform.init();
}

function initProgram() {
    prg = initShaders(gl, "vertex-shader", "fragment-shader");
    gl.useProgram(prg);

    prg.aVertexNormal = gl.getAttribLocation(prg, "aVertexNormal");
    gl.enableVertexAttribArray(prg.aVertexNormal);

    prg.aVertexPosition = gl.getAttribLocation(prg, "aVertexPosition");
    gl.enableVertexAttribArray(prg.aVertexPosition);

    prg.uMVMatrix = gl.getUniformLocation(prg, "uMVMatrix");
    prg.uNMatrix = gl.getUniformLocation(prg, "uNMatrix");
    prg.uPMatrix = gl.getUniformLocation(prg, "uPMatrix");
    prg.uMaterialAmbient = gl.getUniformLocation(prg, "uMaterialAmbient");
    prg.uMaterialDiffuse = gl.getUniformLocation(prg, "uMaterialDiffuse");
    prg.uMaterialSpecular = gl.getUniformLocation(prg, "uMaterialSpecular");
    prg.uShininess = gl.getUniformLocation(prg, "uShininess");
    prg.uLightAmbient = gl.getUniformLocation(prg, "uLightAmbient");
    prg.uLightDiffuse = gl.getUniformLocation(prg, "uLightDiffuse");
    prg.uLightSpecular = gl.getUniformLocation(prg, "uLightSpecular");
    prg.uLightPosition = gl.getUniformLocation(prg, "uLightPosition");
    prg.uUpdateLight = gl.getUniformLocation(prg, "uUpdateLight");
}

function initLights() {
    gl.uniform4fv(prg.uLightPosition, lightPosition);
    gl.uniform4fv(prg.uLightAmbient, lightAmbient);
    gl.uniform4fv(prg.uLightDiffuse, lightDiffuse);
    gl.uniform4fv(prg.uLightSpecular, lightSpecular);
}

function initObjData() {
    gameTicks = 0;
    sphere = new Sphere();
}

window.onload = function init() {
    canvas = document.getElementById("gl-canvas");
    gl = WebGLUtils.setupWebGL(canvas);
    if (!gl) { alert( "WebGL isn't available"); }

    configure();
    initProgram();
    initLights();
    initObjData();

    document.getElementById("Button6").onclick = function(){
	numTimesToSubdivide++;
	sphere.genPoints();
    };
    document.getElementById("Button7").onclick = function(){
	if (numTimesToSubdivide > 0) {
	    numTimesToSubdivide--;
	}
	sphere.genPoints();
    };
    document.getElementById("Button8").onclick = toggleLight;

    intervalId = window.setInterval(updateGame, updateGameDelay);

    canvas.addEventListener('click', onMouseClick);
    window.addEventListener('keydown', onKeyDown);

    render();
};

function render() {
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    updateTransforms();

    gl.uniform1i(prg.uUpdateLight, updateLightPosition);

    if (isAnimating) {
	if (animCount >= animFrames) {
	    isAnimating = false;
	    console.log(caps[lockedCapIndex].getTransformData());
	    console.log('elevation', camera.elevation);
	    console.log('azimuth', camera.azimuth);
	} else {
	    camera.changeElevation(d_elevation);
	    camera.changeAzimuth(d_azimuth);
	    animCount++;
	}
    }

    transform.calculateModelView();
    transform.push();
    var newMVMatrix = sphere.calcTransformMatrix(transform.mvMatrix);
    transform.setMVMatrix(newMVMatrix);
    transform.setMatrixUniforms();
    transform.pop();
    sphere.setLights();
    sphere.redraw();

    for (var i = 0; i < caps.length; i++) {
	var obj = caps[i];
	if (obj.isActive) {
	    transform.calculateModelView();
	    transform.push();
	    newMVMatrix = obj.calcTransformMatrix(transform.mvMatrix);
	    // console.log(vec3(mat4_multiplyVec4(newMVMatrix, vec4(obj.normals[0])))); // the locked one should be close to [0, 0, 1.02]
	    transform.setMVMatrix(newMVMatrix);
	    transform.setMatrixUniforms();
	    transform.pop();
	    obj.setLights();
	    obj.redraw();
	}
    }

    requestAnimFrame(render);
}

function updateTransforms() {
    transform.calculateModelView();
    displayMatrix(transform.mvMatrix);
    var p = {'fovy': fovy, 'aspect': canvas.width / canvas.height,
	     'near': near, 'far': far};
    transform.calculatePerspective(p);
}

function toggleLight() {
    updateLightPosition = !updateLightPosition;
    console.log('updateLightPosition =', updateLightPosition);
}

function Cap(transformData) {
    GameObj.call(this);
    this.ambient = capAmbient;
    this.diffuse = capDiffuse;
    this.specular = capSpecular;
    this.shininess = capShininess;
    this.scaleFactor = getRandomArbitrary(0.1, 0.2);
    this.tx = transformData.tx;
    this.ty = transformData.ty;
    this.S = scale3d(this.scaleFactor, this.scaleFactor, 1.0);
    this.R = mult(rotate(transformData.tx, [1, 0, 0]),
		  rotate(transformData.ty, [0, 1, 0]));
    this.drawMode = gl.TRIANGLE_FAN;
    this.point = function(theta, phi) {
	var t = theta * DEGREE_TO_RADIAN;
	var p = phi * DEGREE_TO_RADIAN;
	var x = capRadius * Math.cos(t) * Math.sin(p);
	var y = capRadius * Math.sin(t) * Math.sin(p);
	var z = capRadius * Math.cos(p);
	return vec4(x, y, z, 1.0);
    };
    this.calcNormals = function() {
	this.normals = [];
	var n;
	for (var i = 0; i < this.vertices.length; i++) {
	    n = vec4(this.vertices[i]);
	    n[3] = 0.0;
	    this.normals.push(n);
	}
    };
    this.genPoints = function() {
	this.vCount = 0;
	this.vertices = [];
	var p;
	var data = [[0,0]];
	for (var i = 0; i < 36; i++) {
	    data.push([i*10,10]);
	}
	data.push([0,10]);
	var theta, phi;
	for (i = 0; i < data.length; i++) {
	    theta = data[i][0];
	    phi = data[i][1];
	    p = this.point(theta, phi);
	    this.vertices.push(p);
	    this.vCount++;
	}
	this.calcNormals();

	gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
	gl.bufferData(gl.ARRAY_BUFFER, flatten(this.vertices), gl.STATIC_DRAW);
	gl.bindBuffer(gl.ARRAY_BUFFER, this.nbo);
	gl.bufferData(gl.ARRAY_BUFFER, flatten(this.normals), gl.STATIC_DRAW);
    };
    this.genPoints();
    this.setLights = function() {
	gl.uniform4fv(prg.uMaterialAmbient, this.ambient);
	gl.uniform4fv(prg.uMaterialDiffuse, this.diffuse);
	gl.uniform4fv(prg.uMaterialSpecular, this.specular);
	gl.uniform1f(prg.uShininess, this.shininess);
    };
    this.calcTransformMatrix = function(m) {
	var a = mat4();		// identity
	a = mult(mult(mult(a, m), this.R), this.S);
	return a;
    };
    this.redraw = function() {
	gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
	gl.vertexAttribPointer(prg.aVertexPosition, 4, gl.FLOAT, false, 0, 0);
	gl.bindBuffer(gl.ARRAY_BUFFER, this.nbo);
	gl.vertexAttribPointer(prg.aVertexNormal, 4, gl.FLOAT, false, 0, 0);
	gl.drawArrays(this.drawMode, this.beginVIndex, this.vCount);
    };
    this.update = function() {
	if (this.scaleFactor < 1.0) {
	    this.scaleFactor += 0.005;
	}
	this.S = scale3d(this.scaleFactor, this.scaleFactor, 1.0);
	var RX = rotate(transformData.tx, [1, 0, 0]);
	var RY = rotate(transformData.ty, [0, 1, 0]);
	this.R = mult(RY, RX);
    };
    this.getTransformData = function() {
	return transformData;
    };
};

function updateGame() {
    gameTicks++;
    sphere.update();
    for (var i = 0; i < caps.length; i++) {
	caps[i].update();
	if (isInLockingArea(caps[i])) {
	    console.log(i + ' cap is in locking area.');
	}
    }

    if (gameTicks == nextTick) {
	if (caps.length < maxNumCaps) {
	    var a = genNewCapData();
	    addCap(new Cap(a));
	    console.log('num bacterias:', caps.length);
	    document.getElementById("num-bacterias").innerHTML = caps.length;
	}
	nextTick = gameTicks + maxInterval;
    }
}

function clearAllCaps() {
    caps = [];
}

function resetGame() {
    isWin = false;
    isLost = false;
    gameTicks = 1;
    nextTick = maxInterval;
    window.clearInterval(intervalId);
    intervalId = window.setInterval(updateGame, updateGameDelay);
}

function endGame() {
}

function gameWinUpdate() {
}

function gameLostUpdate() {
}

function onMouseClick(event) {
    // var rect = canvas.getBoundingClientRect();
    // var x = event.clientX - rect.left;
    // var y = event.clientY - rect.top;
    // var glx = 2 * x / canvas.width - 1;
    // var gly = 2 * (canvas.height - y) / canvas.height - 1;
    // var polar = xy_to_polar(glx, gly);
    // console.log('[' + polar[0] + ', ' + polar[1] + ']');
    if (lockedCapIndex >= 0 && !isAnimating) {
	console.log('hit', lockedCapIndex);
	caps.splice(lockedCapIndex, 1);
	lockedCapIndex = -1;
	document.getElementById('num-bacterias').innerHTML = caps.length;
    }
}

// function xy_to_polar(x, y) {
//     var theta = Math.atan(y / x);
//     if ((y > 0 && x < 0) || (y < 0 && x < 0)) {
// 	theta += Math.PI;
//     }
//     if (theta < 0) {
// 	theta += Math.PI * 2;
//     }
//     var r = Math.sqrt(Math.pow(x, 2) + Math.pow(y, 2));
//     return [r, theta];
// }

function genNewCapData() {
    return {'tx': getRandomInt(0, 360), 'ty': getRandomInt(0, 360)};
}

function onKeyDown(event) {
    if (event.keyCode == 13) {	// enter
	console.log('enter');
	caps.sort(compareCapsByTx);
	lockACap(0);
    }
    if (event.keyCode == 38) {	// up arrow
	console.log('up');
    } else if (event.keyCode == 40) { // down arrow
	console.log('down');
    } else if (event.keyCode == 37) { // left arrow
	console.log('left');
    } else if (event.keyCode == 39) { // right arrow
	console.log('right');
    }
}

function lockACap(ci) {
    if (caps.length == 0) return;
    isAnimating = true;
    var a = caps[ci].getTransformData();
    var e = a.tx - camera.elevation;
    var z = a.ty - camera.azimuth;
    if (Math.abs(e) > 180 || Math.abs(z) > 180) {
	animFrames = STD_ANIM_FRAMES;
    } else {
	animFrames = STD_ANIM_FRAMES / 2;
    }
    console.log('animFrames', animFrames);
    d_elevation = (a.tx - camera.elevation) / animFrames;
    d_azimuth = (a.ty - camera.azimuth) / animFrames;
    camera.changeElevation(d_elevation);
    camera.changeAzimuth(d_azimuth);
    animCount = 1;
    lockedCapIndex = ci;
}

// tx is the angle that a cap rotates about the x axis
function compareCapsByTx(a, b) {
    return a.tx - b.tx;
}

function compareCapsByTy(a, b) {
    return a.ty - b.ty;
}

function nextCap(dir) {
    switch (dir) {
    case "up":
	caps.sort(compareCapsByTx);
	break;
    case "down":
	caps.sort(compareCapsByTx);
	break;
    case "left":
	break;
    case "right":
	break;
    }
}

function isInLockingArea(cap) {
}
