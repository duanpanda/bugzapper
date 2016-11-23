var canvas;
var gl;
var prg;
const RADIAN_TO_DEGREE = 180 / Math.PI;
const DEGREE_TO_RADIAN = Math.PI / 180;

var numTimesToSubdivide = 1;
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

var lightPosition = vec4(2.0, 1.5, 2, 0.0);
var lightAmbient = vec4(0.2, 0.2, 0.2, 1.0);
var lightDiffuse = vec4(1.0, 1.0, 1.0, 1.0);
var lightSpecular = vec4(1.0, 1.0, 1.0, 1.0);

var sphereAmbient = vec4(1.0, 0.0, 1.0, 1.0);
var sphereDiffuse = vec4(1.0, 0.8, 0.0, 1.0);
var sphereSpecular = vec4(1.0, 0.8, 0.0, 1.0);
var sphereShininess = 100.0;

var mvMatrix, pMatrix, cMatrix, nMatrix;
var transform;

var eye;
var at = vec3(0.0, 0.0, 0.0);
var up = vec3(0.0, 1.0, 0.0);

const CAMERA_ORBIT_TYPE = 1;
const CAMERA_TRACKING_TYPE = 2;

var gameTick = 0;

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
    var s = 0.5;//getRandomArbitrary(0, 0.5);
    this.S = scale3d(s, s, s);
    this.T = translate(1.1,//getRandomArbitrary(0,1),
		       1.5,//getRandomArbitrary(0,1),
		       0.4);//getRandomArbitrary(0,-1));
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
	if (t % 2 == 0) {
	    this.theta++;
	    this.R = rotate(this.theta, [0, 1, 0]);
	}
	// in effect, scale first, rotate second, translate third, then apply
	// the global camera transformation m
	var a = mat4();		// identity
	a = mult(a, m);
	a = mult(a, this.T);
	a = mult(a, this.R);
	a = mult(a, this.S);
	if (t == 1) {
	    logMatrix(a);
	}
	return a;
    };
}

function initTransforms() {
    cMatrix = mat4();
    transform = new SceneTransforms();
    transform.init();
}

function configure() {
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.1, 0.1, 0.1, 1.0);
    gl.enable(gl.DEPTH_TEST);
    initTransforms();
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
    // Scene.addObj(new Sphere());
}

window.onload = function init() {
    canvas = document.getElementById("gl-canvas");
    gl = WebGLUtils.setupWebGL(canvas);
    if (!gl) { alert( "WebGL isn't available"); }

    configure();
    initProgram();
    initLights();
    initObjData();

    document.getElementById("Button0").onclick = function(){radius *= 2.0;};
    document.getElementById("Button1").onclick = function(){radius *= 0.5;};
    document.getElementById("Button2").onclick = function(){theta += dr;};
    document.getElementById("Button3").onclick = function(){theta -= dr;};
    document.getElementById("Button4").onclick = function(){phi += dr;};
    document.getElementById("Button5").onclick = function(){phi -= dr;};
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
	transform.setMVMatrix(mvMatrix);
	transform.push();
	var newMVMatrix = obj.calcTransformMatrix(mvMatrix, gameTick);
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
    eye = vec3(radius * Math.sin(theta) * Math.cos(phi),
	       radius * Math.sin(theta) * Math.sin(phi),
	       radius * Math.cos(theta));
    mvMatrix = lookAt(eye, at, up);
    displayMatrix(mvMatrix);
    var p = {'fovy': fovy, 'aspect': canvas.width / canvas.height,
	     'near': near, 'far': far};
    transform.calculatePerspective(p);
}

function toggleLight() {
    updateLightPosition = !updateLightPosition;
}
