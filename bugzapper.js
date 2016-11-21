var canvas;
var gl;
var program;
const RADIAN_TO_DEGREE = 180 / Math.PI;
const DEGREE_TO_RADIAN = Math.PI / 180;

var numTimesToSubdivide = 3;

var index = 0;

var pointsArray = [];
var normalsArray = [];

var near = -100.0;
var far = 100;
var radius = 1.5;
var theta = 0.0;
var phi = 0.0;
var dr = 5.0 * Math.PI/180.0;

var left = -3.0;
var right = 3.0;
var ytop =3.0;
var bottom = -3.0;

var va = vec4(0.0, 0.0, -1.0, 1);
var vb = vec4(0.0, 0.942809, 0.333333, 1);
var vc = vec4(-0.816497, -0.471405, 0.333333, 1);
var vd = vec4(0.816497, -0.471405, 0.333333,1);

var lightPosition = vec4(1.0, 1.0, 1.0, 0.0 );
var lightAmbient = vec4(0.2, 0.2, 0.2, 1.0 );
var lightDiffuse = vec4(1.0, 1.0, 1.0, 1.0);
var lightSpecular = vec4(1.0, 1.0, 1.0, 1.0);

var materialAmbient = vec4(1.0, 0.0, 1.0, 1.0);
var materialDiffuse = vec4(1.0, 0.8, 0.0, 1.0);
var materialSpecular = vec4(1.0, 0.8, 0.0, 1.0);
var materialShininess = 100.0;

var ctm;
var ambientColor, diffuseColor, specularColor;

var modelViewMatrix, projectionMatrix;
var modelViewMatrixLoc, projectionMatrixLoc;
var eye;
var at = vec3(0.0, 0.0, 0.0);
var up = vec3(0.0, 1.0, 0.0);

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

    this.drawMode = gl.TRIANGLES;
    this.redraw = function() {
	gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
	gl.vertexAttribPointer(program.aVertexPosition, 4, gl.FLOAT,
			       false, 0, 0);
	gl.bindBuffer(gl.ARRAY_BUFFER, this.nbo);
	gl.vertexAttribPointer(program.aVertexNormal, 4, gl.FLOAT,
			       false, 0, 0);
	gl.drawArrays(this.drawMode, this.beginVIndex, this.vCount);
    };

    // obj user can query isActive, but never set it, only set internally
    this.isActive = true;
}

//  Singleton
var Scene = {
    objects : [],
    addObj : function(obj) {
	Scene.objects.push(obj);
    }
};

// Sphere
function Sphere() {
    GameObj.call(this);

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
	}
	else {
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
	this.tetrahedron(va, vb, vc, vd, numTimesToSubdivide);
	gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
	gl.bufferData(gl.ARRAY_BUFFER, flatten(this.vertices), gl.STATIC_DRAW);
	gl.bindBuffer(gl.ARRAY_BUFFER, this.nbo);
	gl.bufferData(gl.ARRAY_BUFFER, flatten(this.normals), gl.STATIC_DRAW);
    };
    this.genPoints();
}

function initObjData() {
    var sphere = new Sphere();
    Scene.addObj(sphere);
}

window.onload = function init() {
    canvas = document.getElementById("gl-canvas");

    gl = WebGLUtils.setupWebGL(canvas);
    if (!gl ) { alert( "WebGL isn't available"); }

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.6, 0.6, 0.6, 1.0);

    gl.enable(gl.DEPTH_TEST);

    program = initShaders(gl, "vertex-shader", "fragment-shader");
    gl.useProgram(program);

    initObjData();

    program.aVertexNormal = gl.getAttribLocation(program, "aVertexNormal");
    gl.enableVertexAttribArray(program.aVertexNormal);

    program.aVertexPosition = gl.getAttribLocation(program, "aVertexPosition");
    gl.enableVertexAttribArray(program.aVertexPosition);

    modelViewMatrixLoc = gl.getUniformLocation(program, "uMVMatrix");
    projectionMatrixLoc = gl.getUniformLocation(program, "uPMatrix");

    document.getElementById("Button0").onclick = function(){radius *= 2.0;};
    document.getElementById("Button1").onclick = function(){radius *= 0.5;};
    document.getElementById("Button2").onclick = function(){theta += dr;};
    document.getElementById("Button3").onclick = function(){theta -= dr;};
    document.getElementById("Button4").onclick = function(){phi += dr;};
    document.getElementById("Button5").onclick = function(){phi -= dr;};
    document.getElementById("Button6").onclick = function(){
	numTimesToSubdivide++;
	index = 0;
	pointsArray = [];
	normalsArray = [];
	init();
    };
    document.getElementById("Button7").onclick = function(){
	if (numTimesToSubdivide) numTimesToSubdivide--;
	index = 0;
	pointsArray = [];
	normalsArray = [];
	init();
    };

    var ambientProduct = mult(lightAmbient, materialAmbient);
    var diffuseProduct = mult(lightDiffuse, materialDiffuse);
    var specularProduct = mult(lightSpecular, materialSpecular);
    gl.uniform4fv(gl.getUniformLocation(program, "uLightAmbient"),
		  flatten(ambientProduct));
    gl.uniform4fv(gl.getUniformLocation(program, "uLightDiffuse"),
		  flatten(diffuseProduct));
    gl.uniform4fv(gl.getUniformLocation(program, "uLightSpecular"),
		  flatten(specularProduct));
    gl.uniform4fv(gl.getUniformLocation(program, "uLightPosition"),
		  flatten(lightPosition));
    gl.uniform1f(gl.getUniformLocation(program, "uShininess"),
		 materialShininess);

    render();
};

function render() {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    eye = vec3(radius*Math.sin(theta)*Math.cos(phi),
	       radius*Math.sin(theta)*Math.sin(phi), radius*Math.cos(theta));

    modelViewMatrix = lookAt(eye, at , up);
    projectionMatrix = ortho(left, right, bottom, ytop, near, far);

    gl.uniformMatrix4fv(modelViewMatrixLoc, false, flatten(modelViewMatrix));
    gl.uniformMatrix4fv(projectionMatrixLoc, false, flatten(projectionMatrix));

    for (var i = 0; i < Scene.objects.length; i++) {
	Scene.objects[i].redraw();
    }

    window.requestAnimFrame(render);
}
