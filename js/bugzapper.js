var canvas;
var gl;
var prg;
const RADIAN_TO_DEGREE = 180 / Math.PI;
const DEGREE_TO_RADIAN = Math.PI / 180;

var numTimesToSubdivide = 5;
var updateLightPosition = false;
var disableLighting = false;
var isWorld = true;		// world or camera space

var near = 0.2;
var far = 5000;
var fovy = 90;

var va = vec4(0.0, 0.0, -1.0, 1.0);
var vb = vec4(0.0, 0.942809, 0.333333, 1.0);
var vc = vec4(-0.816497, -0.471405, 0.333333, 1.0);
var vd = vec4(0.816497, -0.471405, 0.333333, 1.0);

var lightPosition = vec4(2.0, 2.0, 1.6, 0.0);
var lightAmbient = vec4(0.2, 0.2, 0.2, 1.0);
var lightDiffuse = vec4(1.0, 1.0, 1.0, 1.0);
var lightSpecular = vec4(1.0, 1.0, 1.0, 1.0);
var sphereAmbient = vec4(0.1, 0.1, 0.1, 1.0);
var sphereDiffuse = vec4(1.0, 0.8, 0.0, 1.0);
var sphereSpecular = vec4(1.0, 0.8, 0.0, 1.0);
var sphereShininess = 100.0;
var capColorPallete = [
    vec4(1.0, 0.0, 0.0, 1.0),
    vec4(116/255, 23/255, 1.0, 1.0),
    vec4(0.0, 1.0, 0.0, 1.0),
    vec4(1.0, 0.0, 144/255, 1.0),
    vec4(1.0, 112/255, 112/255, 0.0, 1.0)];
var capShininess = 200.0;

var transform;
var camera;
var cameraInteractor;
var sphereInteractor;

const CAMERA_ORBIT_TYPE = 1;
const CAMERA_TRACKING_TYPE = 2;

var capRadius = 1.008;
var maxNumCaps = 5;
var maxNumExplosions = 10;
var maxNumParticlePoints = 1000;

var intervalId = 0;
var updateGameDelay = 80;
var isWin = false;
var isLost = false;
var gameTicks = 1;
var maxInterval = 50;
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
var explosions = [];

var computerPoints = 0;
var computerWinningPoints = maxNumCaps;
var playerPoints = 0;

// Game Object Class
function GameObj() {
    this.vertices = [];
    this.normals = [];
    this.colors = [];
    this.vbo = gl.createBuffer();
    this.cbo = gl.createBuffer();
    this.nbo = gl.createBuffer();
    this.color = vec4(0.0, 0.0, 0.0, 1.0);

    // visible parts
    this.beginVIndex = 0;
    this.vCount = this.vertices.length;

    // obj user can query isActive, but never set it, only set internally
    this.isActive = true;

    this.drawMode = gl.TRIANGLES;
    this.redraw = function() {
	gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
	gl.vertexAttribPointer(prg.aVertexPosition, 4, gl.FLOAT, false, 0, 0);
	if (disableLighting) {
	    gl.bindBuffer(gl.ARRAY_BUFFER, this.cbo);
	    gl.enableVertexAttribArray(prg.aVertexColor);
	    gl.disableVertexAttribArray(prg.aVertexNormal);
	    gl.vertexAttribPointer(prg.aVertexColor, 4, gl.FLOAT, false, 0, 0);
	} else {
	    gl.bindBuffer(gl.ARRAY_BUFFER, this.nbo);
	    gl.enableVertexAttribArray(prg.aVertexNormal);
	    gl.disableVertexAttribArray(prg.aVertexColor);
	    gl.vertexAttribPointer(prg.aVertexNormal, 4, gl.FLOAT, false, 0, 0);
	}
	gl.drawArrays(this.drawMode, this.beginVIndex, this.vCount);
    };
    this.setColor = function(c) {
	this.color = c;
	if (this.colors.length != this.vertices.length) {
	    this.colors = new Array(this.vertices.length);
	}
	for (var i = 0; i < this.colors.length; i++) {
	    this.colors[i] = c;
	}
	gl.bindBuffer(gl.ARRAY_BUFFER, this.cbo);
	gl.bufferData(gl.ARRAY_BUFFER, flatten(this.colors), gl.STATIC_DRAW);
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
    this.rx = 0;		// degrees rotates about x axis
    this.ry = 0; 		// degrees rotates about y axis
    this.R = mat4();

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

	this.setColor(sphereDiffuse);
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

    // rx and ry are degrees the sphere rotates about x and y axis respectively
    this.rotate = function(dx, dy) {
	var rotate_y = rotate(dx, [0, 1, 0]);
	var rotate_x = rotate(dy, [1, 0, 0]);
	var newRotate = mult(rotate_y, rotate_x); // order doesn't matter
	this.R = mult(newRotate, this.R); // order is very important
    };
}

function configure() {
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(1.0, 1.0, 1.0, 1.0);
    gl.enable(gl.DEPTH_TEST);

    camera = new Camera(CAMERA_ORBIT_TYPE);
    camera.goHome([0.0, 0.0, 1.5]);

    if (isWorld) {
	sphereInteractor = new SphereInteractor(camera, canvas);
    } else {
	cameraInteractor = new CameraInteractor(camera, canvas);
    }

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

    prg.aVertexColor = gl.getAttribLocation(prg, "aVertexColor");
    gl.enableVertexAttribArray(prg.aVertexColor);

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
    prg.uPerVertexColor = gl.getUniformLocation(prg, "uPerVertexColor");
    prg.uPointSize = gl.getUniformLocation(prg, "uPointSize");
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
    explosions = [];
    for (var i = 0; i < maxNumExplosions; i++) {
	explosions.push(new Explosion());
    }
    caps = [];
    addCap(new Cap(genNewCapData(), sphere));
    document.getElementById("num-bacterias").innerHTML = caps.length;
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
	sphere.setColor(sphereDiffuse);
    };
    document.getElementById("Button7").onclick = function(){
	if (numTimesToSubdivide > 0) {
	    numTimesToSubdivide--;
	}
	sphere.genPoints();
	sphere.setColor(sphereDiffuse);
    };
    document.getElementById("Button8").onclick = toggleLightPos;
    document.getElementById("Button1").onclick = toggleLighting;
    document.getElementById("Button2").onclick = toggleWorldOrCamera;
    document.getElementById("reset").onclick = resetGame;

    intervalId = window.setInterval(updateGame, updateGameDelay);

    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('keydown', onKeyDown);

    render();
};

function render() {
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    updateTransforms();

    gl.uniform1i(prg.uUpdateLight, updateLightPosition);
    gl.uniform1i(prg.uPerVertexColor, disableLighting);

    if (isAnimating) {
	if (animCount >= animFrames) {
	    isAnimating = false;
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
	var cap = caps[i];
	transform.push();
	cap.updateRotation();
	newMVMatrix = cap.calcTransformMatrix(transform.mvMatrix);
	transform.setMVMatrix(newMVMatrix);
	transform.setMatrixUniforms();
	transform.pop();
	cap.setLights();
	cap.redraw();
    }

    gl.uniform1i(prg.uPerVertexColor, true); // for explosions only
   for (i = 0; i < explosions.length; i++) {
	var explosion = explosions[i];
	if (explosion.isActive) {
	    transform.push();
	    newMVMatrix = explosion.calcTransformMatrix(transform.mvMatrix);
	    transform.setMVMatrix(newMVMatrix);
	    transform.setMatrixUniforms();
	    transform.pop();
	    explosion.redraw();
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

function toggleLightPos() {
    updateLightPosition = !updateLightPosition;
    console.log('updateLightPosition =', updateLightPosition);
}

function toggleLighting() {
    disableLighting = !disableLighting;
    console.log('disableLighting =', disableLighting);
    document.getElementById('toggle-lighting').innerHTML = disableLighting ? 'Lighting Disabled' : 'Lighting Enagled';
}

function toggleWorldOrCamera() {
    isWorld = !isWorld;
    configure();
    document.getElementById('camera-or-world').innerHTML = isWorld ? 'World' : 'Camera';
}

function Cap(transformData, sphere) {
    GameObj.call(this);
    this.ambient = capColorPallete[getRandomInt(0, capColorPallete.length)];
    this.diffuse = this.ambient;
    this.specular = this.diffuse;
    this.shininess = capShininess;
    this.scaleFactor = 0.1;
    this.tx = transformData.tx;
    this.ty = transformData.ty;
    this.S = scale3d(this.scaleFactor, this.scaleFactor, 1.0);
    this.R = mult(rotate(transformData.tx, [1, 0, 0]),
		  rotate(transformData.ty, [0, 1, 0]));
    // theta: angle with x axis in x-y plane
    // phi: angle with z axis in 3D space
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

	// start TRIANGLE_FAN
	var data = [[0, 0]];	// format: [theta, phi]
	for (var i = 0; i <= 36; i++) {
	    data.push([i * 10, 1]);
	}
	// end TRIANGLE_FAN, 1 center, 37 points in the circle
	// start TRIANGLE_STRIP
	for (i = 0; i < 36; i++) {
	    for (var j = 1; j < 10; j++) {
		data.push([i*10, j]);
		data.push([i*10, j+1]);
		data.push([(i+1)*10, j]);

		data.push([i*10, j+1]);
		data.push([(i+1)*10, j]);
		data.push([(i+1)*10, j+1]);
	    }
	}
	// end TRIANGLE_STRIP
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

	this.setColor(this.diffuse);
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
	if (disableLighting) {
	    gl.bindBuffer(gl.ARRAY_BUFFER, this.cbo);
	    gl.enableVertexAttribArray(prg.aVertexColor);
	    gl.disableVertexAttribArray(prg.aVertexNormal);
	    gl.vertexAttribPointer(prg.aVertexColor, 4, gl.FLOAT, false, 0, 0);
	} else {
	    gl.bindBuffer(gl.ARRAY_BUFFER, this.nbo);
	    gl.enableVertexAttribArray(prg.aVertexNormal);
	    gl.disableVertexAttribArray(prg.aVertexColor);
	    gl.vertexAttribPointer(prg.aVertexNormal, 4, gl.FLOAT, false, 0, 0);
	}
	gl.drawArrays(gl.TRIANGLE_FAN, 0, 38);
	gl.drawArrays(gl.TRIANGLE_STRIP, 38, this.vCount - 38);
    };
    this.update = function() {
	if (this.scaleFactor < 1.0) {
	    this.scaleFactor += 0.005;
	    if (this.scaleFactor >= 1.0) {
		computerPoints += 1;
		document.getElementById('computer-points').innerHTML = computerPoints;
	    }
	}
	this.S = scale3d(this.scaleFactor, this.scaleFactor, 1.0);
    };
    this.getTransformData = function() {
	return transformData;
    };
    this.updateRotation = function() {
	var RX = rotate(transformData.tx, [1, 0, 0]);
	var RY = rotate(transformData.ty, [0, 1, 0]);
	var newRotate = mult(RY, RX);
	this.R = mult(sphere.R, newRotate);
    };
};

function updateGame() {
    gameTicks++;
    if (isWin) {
	gameWinUpdate();
	return;
    }

    if (isLost) {
	gameLostUpdate();
	return;
    }

    if (isAllCapsClear()) {
	nextTick = 0;
	isWin = true;
	console.log('you win');
	return;
    }

    if (computerPoints >= computerWinningPoints) {
	nextTick = 0;
	isLost = true;
	console.log('you lose');
	return;
    }

    // if not win and not lost, then do the normal update

    // generate new bacteria
    if (gameTicks == nextTick) {
	if (caps.length < maxNumCaps) {
	    addCap(new Cap(genNewCapData(), sphere));
	    document.getElementById("num-bacterias").innerHTML = caps.length;
	}
	nextTick = gameTicks + maxInterval;
    }

    sphere.update();
    updateEachBacteria();
    updateEachExplosion();
}

function clearAllCaps() {
    caps = [];
}

function isAllCapsClear() {
    return caps.length == 0;
}

function resetGame() {
    isWin = false;
    isLost = false;
    clearAllCaps();
    initObjData();
    nextTick = maxInterval;
    window.clearInterval(intervalId);
    intervalId = window.setInterval(updateGame, updateGameDelay);
    lockedCapIndex = -1;
    // reset all the text
    computerPoints = 0;
    document.getElementById('computer-points').innerHTML = computerPoints;
    playerPoints = 0;
    document.getElementById('player-points').innerHTML = playerPoints;
    document.getElementById('is-locked').innerHTML = '';
    document.getElementById('win-or-lose').innerHTML = '';
    canvas.addEventListener('mousedown', onMouseDown);

    configure();
}

function endGame() {
    if (isWin) {
	document.getElementById("win-or-lose").innerHTML = "YOU WIN";
    } else if (isLost) {
	document.getElementById("win-or-lose").innerHTML = "YOU LOSE";
    }
    window.clearInterval(intervalId);
    canvas.removeEventListener("mousedown", onMouseDown);
}

function gameWinUpdate() {
    updateEachBacteria();
    updateEachExplosion();
    if (isExplosionAnimDone()) {
	endGame();
    }
}

function gameLostUpdate() {
    gameWinUpdate();
}

function updateEachBacteria() {
    for (var i = 0; i < caps.length; i++) {
	caps[i].update();
	if (isInLockingArea(caps[i])) {
	    document.getElementById('is-locked').innerHTML = 'a bacteria is LOCKED (shootable)';
	    lockedCapIndex = i;
	} else {
	    if (lockedCapIndex == i) {
		document.getElementById('is-locked').innerHTML = '';
		lockedCapIndex = -1;
	    }
	}
    }
    if (lockedCapIndex == -1) {
	document.getElementById('is-locked').innerHTML = '';
    }
}

function updateEachExplosion() {
    for (var i = 0; i < explosions.length; i++) {
	if (!explosions[i].isActive) {
	    continue;
	}
	explosions[i].update();
    }
}

function onMouseDown(event) {
    var rect = canvas.getBoundingClientRect();
    var x = event.clientX - rect.left;
    var y = event.clientY - rect.top;
    var glx = 2 * x / canvas.width - 1;
    var gly = 2 * (canvas.height - y) / canvas.height - 1;
    var r = Math.sqrt(Math.pow(glx, 2) + Math.pow(gly, 2));
    if (lockedCapIndex >= 0 && !isAnimating) {
	if (r < 0.3) {
	    console.log('hit', lockedCapIndex);

	    var ei = getIdleExplosionIndex();
	    console.log('ei', ei);
	    if (ei != -1) {
		var explosion = explosions[ei];
		explosion.activate();
		explosion.init(caps[lockedCapIndex]);
	    }

	    caps.splice(lockedCapIndex, 1);
	    lockedCapIndex = -1;
	    document.getElementById('num-bacterias').innerHTML = caps.length;
	    playerPoints += 1;
	    document.getElementById('player-points').innerHTML = playerPoints;
	}
    }
}

function genNewCapData() {
    return {'tx': getRandomInt(0, 360), 'ty': getRandomInt(0, 360)};
    // return {'tx': 154, 'ty': 83};
}

function onKeyDown(event) {
    if (event.keyCode == 13 && !isWorld) {	// enter
	// console.log('enter');
	caps.sort(compareCapsByTx);
	lockACap(0);
    }
    if (event.keyCode == 38) {	// up arrow
	// console.log('up');
    } else if (event.keyCode == 40) { // down arrow
	// console.log('down');
    } else if (event.keyCode == 37) { // left arrow
	// console.log('left');
    } else if (event.keyCode == 39) { // right arrow
	// console.log('right');
    }
}

function lockACap(ci) {
    if (caps.length == 0 || isAnimating) return;
    isAnimating = true;
    var a = caps[ci].getTransformData();
    var e = a.tx - camera.elevation;
    var z = a.ty - camera.azimuth;
    if (Math.abs(e) > 180 || Math.abs(z) > 180) {
	animFrames = STD_ANIM_FRAMES;
    } else {
	animFrames = STD_ANIM_FRAMES / 2;
    }
    // console.log('animFrames', animFrames);
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
    var capMatrix = cap.calcTransformMatrix(transform.mvMatrix);
    var capNormal = vec3(mat4_multiplyVec4(capMatrix, vec4(cap.normals[0])));
    var origNormal = vec3(0, 0, capRadius);
    var angle = vectorsAngle(capNormal, origNormal);
    return angle < 3;
}

function SphereInteractor(camera, canvas) {
    this.camera = camera;
    this.canvas = canvas;
    this.update();
    this.dragging = false;
    this.x = 0;
    this.y = 0;
    this.lastX = 0;
    this.lastY = 0;
    this.button = 0;
    this.MOTION_FACTOR = 10.0;
}

SphereInteractor.prototype.onMouseUp = function(ev) {
    this.dragging = false;
};

SphereInteractor.prototype.onMouseDown = function(ev) {
    this.dragging = true;
    this.x = ev.clientX;
    this.y = ev.clientY;
    this.button = ev.button;
};

SphereInteractor.prototype.onMouseMove = function(ev) {
    this.lastX = this.x;
    this.lastY = this.y;
    this.x = ev.clientX;
    this.y = ev.clientY;
    if (!this.dragging) return;
    var dx = this.x - this.lastX;
    var dy = this.y - this.lastY;
    if (this.button == 0) {	// left mouse button
	this.rotate(dx, dy);
    }
};

SphereInteractor.prototype.update = function() {
    var self = this;
    var canvas = this.canvas;
    canvas.addEventListener('mousedown', function(ev) {
	self.onMouseDown(ev);
    });
    canvas.addEventListener('mouseup', function(ev) {
	self.onMouseUp(ev);
    });
    canvas.addEventListener('mousemove', function(ev) {
	self.onMouseMove(ev);
    });
};

SphereInteractor.prototype.rotate = function(dx, dy) {
    sphere.rotate(dx / 10, dy / 10); // degrees
};

function Explosion() {
    GameObj.call(this);
    this.tx = 0;
    this.ty = 0;
    this.drawMode = gl.POINTS;
    this.velocities = [];
    this.pointSize = 4;
    this.isActive = false;
    this._genPoints = function(cap) {
	var a = cap.vertices[0];
	this.vertices = [];
	for (var i = 0; i < maxNumParticlePoints; i++) {
	    this.vertices.push(vec4(a[0], a[1], a[2], a[3]));
	}
	this.vCount = i;
	gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
	gl.bufferData(gl.ARRAY_BUFFER, flatten(this.vertices), gl.STATIC_DRAW);
    };
    this._genVelocities = function() {
	if (this.velocities.length != this.vertices.length) {
	    this.velocities = new Array(this.vertices.length);
	}
	for (var i = 0; i < this.velocities.length; i++) {
	    var vx = getRandomInt(i / 10, (i+1) / 10) * getRandomArbitrary(-0.0005, 0.0005);
	    var vy = getRandomInt(i / 10, (i+1) / 10) * getRandomArbitrary(-0.0005, 0.0005);
	    var vz = getRandomInt(i / 10, (i+1) / 10) * getRandomArbitrary(0.0001, 0.0005);
	    this.velocities[i] = vec3(vx, vy, vz);
	}
    };
    this.init = function(cap) {
	this.tx = cap.tx;
	this.ty = cap.ty;
	// this.scaleFactor = cap.scaleFactor;
	this.color = cap.diffuse;
	// this.S = scale3d(0.5, 0.5, 1.0);
	this.R = cap.R;
	this._genPoints(cap);
	this._genVelocities();
	this.setColor(this.color);
    };
    this.redraw = function() {
	gl.uniform1f(prg.uPointSize, this.pointSize);
	gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
	gl.vertexAttribPointer(prg.aVertexPosition, 4, gl.FLOAT, false, 0, 0);
	gl.bindBuffer(gl.ARRAY_BUFFER, this.cbo);
	gl.enableVertexAttribArray(prg.aVertexColor);
	gl.disableVertexAttribArray(prg.aVertexNormal);
	gl.vertexAttribPointer(prg.aVertexColor, 4, gl.FLOAT, false, 0, 0);
	gl.drawArrays(this.drawMode, this.beginVIndex, this.vCount);
    };
    // pre: isActive == true
    this.update = function() {
	if (gameTicks % 2 == 0) {
	    this.pointSize--;
	    if (this.pointSize == 0) {
		this.inactivate();
	    }
	}
	for (var i = 0; i < this.vertices.length; i++) {
	    this.vertices[i][0] += this.velocities[i][0];
	    this.vertices[i][1] += this.velocities[i][1];
	    this.vertices[i][2] += this.velocities[i][2];
	    if (this.velocities[i][0] > 0) {
		this.velocities[i][0] -= 0.001;
	    } else if (this.velocities[i][0] < 0) {
		this.velocities[i][0] += 0.001;
	    }
	    if (this.velocities[i][1] > 0) {
		this.velocities[i][1] -= 0.001;
	    } else if (this.velocities[i][1] < 0) {
		this.velocities[i][1] += 0.001;
	    }
	    if (this.velocities[i][2] > 0) {
		this.velocities[i][2] -= 0.001;
	    } else if (this.velocities[i][1] < 0) {
		this.velocities[i][2] += 0.001;
	    }
	}
	gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
	gl.bufferData(gl.ARRAY_BUFFER, flatten(this.vertices), gl.STATIC_DRAW);
    };
    this.activate = function() {
	this.isActive = true;
	this.pointSize = 4;
    };
    this.inactivate = function() {
	this.isActive = false;
    };
    this.calcTransformMatrix = function(m) {
	// return mult(mult(mult(mat4(), m), this.R), this.S);
	return mult(mult(mat4(), m), this.R);
    };
}

function getIdleExplosionIndex() {
    for (var i = 0; i < explosions.length; i++) {
	if (!explosions[i].isActive) {
	    return i;
	}
    }
    return -1;
}

function isExplosionAnimDone() {
    for (var i = 0; i < explosions.length; i++) {
	if (explosions[i].isActive) {
	    return false;
	}
    }
    return true;
}
