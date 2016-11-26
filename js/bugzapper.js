var canvas;
var gl;
var prg;
const RADIAN_TO_DEGREE = 180 / Math.PI;
const DEGREE_TO_RADIAN = Math.PI / 180;

var numTimesToSubdivide = 5;
var updateLightPosition = false;

var near = 0.2;
var far = 5000;
var radius = 1.5;
var theta = 0.0;
var phi = 0.0;
var dr = 5.0 * DEGREE_TO_RADIAN;
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

var eye;
var at = vec3(0.0, 0.0, 0.0);
var up = vec3(0.0, 1.0, 0.0);

const CAMERA_ORBIT_TYPE = 1;
const CAMERA_TRACKING_TYPE = 2;

var gameTick = 0;

var capRadius = 1.01;

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
    this.calcTransformMatrix = function(m, t) {
	return m;
    };
    this.setLights = function() {
    };
}

//  Singleton
var Scene = {
    objects : [],
    addObj : function(obj) {
	Scene.objects.push(obj);
    },
    reset : function() {
	Scene.objects = [];
    }
};

// Sphere
function Sphere() {
    GameObj.call(this);
    this.ambient = sphereAmbient;
    this.diffuse = sphereDiffuse;
    this.specular = sphereSpecular;
    this.shininess = sphereShininess;
    var s = 1.0;
    this.S = scale3d(s, s, s);
    this.T = translate(0.0,//getRandomArbitrary(0,1),
		       0.0,//getRandomArbitrary(0,1),
		       0.0);//getRandomArbitrary(0,-1));
    this.theta = 1;
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
    this.calcTransformMatrix = function(m, t) {
	// in effect, scale first, rotate second, translate third, then apply
	// the global camera transformation m
	var a = mat4();		// identity
	a = mult(mult(mult(mult(a, m), this.T), this.R), this.S);
	return a;
    };
}

function configure() {
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.1, 0.1, 0.1, 1.0);
    gl.enable(gl.DEPTH_TEST);

    camera = new Camera(CAMERA_ORBIT_TYPE);
    camera.goHome([0.0, 0.0, -1.5]);

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
    theta = 0.0;
    gameTick = 0;
    Scene.reset();
    var sphere = new Sphere();
    Scene.addObj(sphere);
    for (var i = 0; i < 5; i++) {
	Scene.addObj(new Cap());
    };
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
	for (var i = 0; i < Scene.objects.length; i++) {
	    Scene.objects[i].genPoints();
	}
    };
    document.getElementById("Button7").onclick = function(){
	if (numTimesToSubdivide > 0) {
	    numTimesToSubdivide--;
	}
	for (var i = 0; i < Scene.objects.length; i++) {
	    Scene.objects[i].genPoints();
	}
    };
    document.getElementById("Button8").onclick = toggleLight;

    render();
};

function render() {
    gameTick++;

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    updateTransforms();

    gl.uniform1i(prg.uUpdateLight, updateLightPosition);

    for (var i = 0; i < Scene.objects.length; i++) {
	var obj = Scene.objects[i];

	transform.calculateModelView();
	transform.push();
	var newMVMatrix = obj.calcTransformMatrix(transform.mvMatrix, gameTick);
	transform.setMVMatrix(newMVMatrix);
	transform.setMatrixUniforms();
	transform.pop();

	obj.setLights();
	obj.redraw();
    }

    requestAnimFrame(render);
}

function updateTransforms() {
    // theta = 30 * DEGREE_TO_RADIAN;
    // phi += dr / 5;
    // radius += 0.01;
    // eye = vec3(radius * Math.cos(theta) * Math.sin(phi),
    // 	       radius * Math.sin(theta) * Math.sin(phi),
    // 	       radius * Math.cos(phi));
    // transform.setMVMatrix(lookAt(eye, at, up));
    displayMatrix(transform.mvMatrix);
    var p = {'fovy': fovy, 'aspect': canvas.width / canvas.height,
	     'near': near, 'far': far};
    transform.calculatePerspective(p);
}

function toggleLight() {
    updateLightPosition = !updateLightPosition;
    console.log('updateLightPosition =', updateLightPosition);
}

function Cap() {
    GameObj.call(this);
    this.ambient = capAmbient;
    this.diffuse = capDiffuse;
    this.specular = capSpecular;
    this.shininess = capShininess;
    this.theta = getRandomInt(0, 360);
    this.vector = vec3(Math.random(), Math.random(), Math.random());
    this.scaleFactor = getRandomArbitrary(0.5, 1.5);
    this.S = scale3d(this.scaleFactor, this.scaleFactor, 1.0);
    this.T = mat4();
    this.R = rotate(this.theta, [1, 1, 1]);
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
    this.calcTransformMatrix = function(m, t) {
	if (this.scaleFactor < 1.2) {
	    this.scaleFactor += 0.001;
	}
	this.S = scale3d(this.scaleFactor, this.scaleFactor, 1.0);
	this.R = rotate(this.theta, this.vector);
	var a = mat4();		// identity
	a = mult(mult(mult(mult(a, m), this.T), this.R), this.S);
	return a;
    };
    this.redraw = function() {
	gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
	gl.vertexAttribPointer(prg.aVertexPosition, 4, gl.FLOAT, false, 0, 0);
	gl.bindBuffer(gl.ARRAY_BUFFER, this.nbo);
	gl.vertexAttribPointer(prg.aVertexNormal, 4, gl.FLOAT, false, 0, 0);
	gl.drawArrays(this.drawMode, this.beginVIndex, this.vCount);
    };
};
