var canvas;
var gl;
var program;

var vBuf = null;
var cBuf = null;

var baseColors = [
    vec3(0.0, 0.0, 0.0), // black
    vec3(1.0, 0.0, 0.0), // red
    vec3(1.0, 1.0, 0.0), // yellow
    vec3(0.0, 1.0, 0.0), // green
    vec3(0.0, 0.0, 1.0), // blue
    vec3(1.0, 0.0, 1.0), // magenta
    vec3(0.0, 1.0, 1.0), // cyan
    vec3(0.7, 0.9, 0.3), // yellow-green
    vec3(0.8, 0.2, 0.2)	 // dark red
];

var maxNumTriangles = 5000;
var maxNumVertices = 3 * maxNumTriangles;
const BYTES_PER_VERTEX = Float32Array.BYTES_PER_ELEMENT * 2;
const BYTES_PER_VERTEX_COLOR = Float32Array.BYTES_PER_ELEMENT * 3;
var vertexBufferSize = BYTES_PER_VERTEX * maxNumVertices;
var colorBufferSize = vertexBufferSize;
// vertex index in GL vertex buffer, count and reference vertices
var vIndex = 0;
var thetaLoc;

// attributes that configure the game and the game objects
var rDisk = 0.7;
var rCrustInner = rDisk;
var rCrustOuter = 0.8;
var diskColorIndex = 7;

// game controls
var gameTicks = 1;
var maxNumBact = 10;
var maxDt = 15;
var intervalId = 0;

// game objects
var objs = [];

window.onload = function init()
{
    canvas = document.getElementById("gl-canvas");

    gl = WebGLUtils.setupWebGL(canvas);
    if (!gl) { alert("WebGL isn't available"); }

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.0, 0.0, 0.0, 1.0);

    program = initShaders(gl, "vertex-shader", "fragment-shader");
    gl.useProgram(program);

    var vPosition = gl.getAttribLocation(program, "vPosition");
    gl.enableVertexAttribArray(vPosition);

    var vColor = gl.getAttribLocation(program, "vColor");
    gl.enableVertexAttribArray(vColor);

    thetaLoc = gl.getUniformLocation(program, "theta");

    vBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vBuf);
    gl.bufferData(gl.ARRAY_BUFFER, vertexBufferSize, gl.STATIC_DRAW);

    cBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, cBuf);
    gl.bufferData(gl.ARRAY_BUFFER, colorBufferSize, gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, vBuf);
    gl.vertexAttribPointer(vPosition, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, cBuf);
    gl.vertexAttribPointer(vColor, 3, gl.FLOAT, false, 0, 0);

    initObjData();

    canvas.addEventListener("mousedown", function(event) {
	var x = event.clientX;
	var y = event.clientY;
	console.log('xy:', x, y);
	var glx = 2 * x / canvas.width - 1;
	var gly = 2 * (canvas.height - y) / canvas.height - 1;
	console.log('gl_xy:', glx, gly);
	var polar = xy_to_polar(glx, gly);
	console.log('polar:', polar[0], polar[1]);
	for (var i = 0; i < bacteriaList.length; i++) {
	    var theta1 = bacteriaList[i].thetaBegin;
	    var theta2 = bacteriaList[i].thetaEnd;
	    if (isInBacteria(polar, rCrustInner, rCrustOuter, theta1, theta2)) {
		console.log('mouse in', i+'th', 'bacteria');
	    }
	}
    });

    intervalId = window.setInterval(updateGame, 150);

    render();
};

function initObjData()
{
    var disk = new Disk(0.0, 0.0, rDisk, vec3(0.7, 0.9, 0.3));
    console.log(disk);
    objs.push(disk);
    for (var i = 0; i < maxNumBact; i++) {
	var b = new Bacteria(getRandomInt(0, 360), maxDt, baseColors[getRandomInt(1, 6)]);
	objs.push(b);
    }
    vIndex = 0;
    for (var j = 0; j < objs.length; j++) {
	addGLObj(objs[j]);
    }
}

function addGLObj(obj)
{
    gl.bindBuffer(gl.ARRAY_BUFFER, vBuf);
    var v = flatten(obj.vertices);
    gl.bufferSubData(gl.ARRAY_BUFFER, vIndex * BYTES_PER_VERTEX, v);

    gl.bindBuffer(gl.ARRAY_BUFFER, cBuf);
    var c = flatten(obj.colors);
    gl.bufferSubData(gl.ARRAY_BUFFER, vIndex * BYTES_PER_VERTEX_COLOR, c);

    vIndex += obj.vertices.length;
}

function updateGame()
{
    gameTicks++;
    if (gameTicks > 10000) {
	window.clearInterval(intervalId);
	gameTicks = 1;
	return;
    }
}

function render()
{
    gl.clear(gl.COLOR_BUFFER_BIT);
    var vIndex = 0;      // vertex index in vertex buffer and color buffer
    for (var i = 0; i < objs.length; i++) {
	gl.uniform1f(thetaLoc, objs[i].theta);
	gl.drawArrays(objs[i].drawMode, vIndex, objs[i].vertices.length);
	vIndex += objs[i].vertices.length;
    }
    window.requestAnimFrame(render);
}

function assert(condition, message)
{
    if (!condition) {
	message = message || "Assertion failed";
	if (typeof Error !== "undefined") {
	    throw new Error(message);
	}
	throw message; // fallback
    }
}

/**
 * Return a random integer between min (included) and max (excluded).
 */
function getRandomInt(min, max)
{
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min)) + min;
}

function GameObj()
{
    this.vertices = [];
    this.colors = [];
    this.color = vec3(0.0, 0.0, 0.0);
    this.setColor = function(c) {
	this.color = c;
	if (this.colors.length != this.vertices.length) {
	    this.colors = new Array(this.vertices.length);
	}
	for (var i = 0; i < this.colors.length; i++) {
	    this.colors[i] = c;
	}
    };
    this.theta = 0.0;
}

function Disk(x, y, r, c)
{
    GameObj.call(this);
    this.x = x;
    this.y = y;
    this.radius = r;
    this.drawMode = gl.TRIANGLE_FAN;

    this.genCirclePoints = function() {
	if (this.vertices.length != 362) {
	    this.vertices = new Array(362);
	}
	this.vertices[0] = vec2(x, y);
	for (var i = 0; i < 360; i++) {
	    var t = i / 180 * Math.PI;
	    var nx = x + r * Math.cos(t);
	    var ny = y + r * Math.sin(t);
	    this.vertices[i+1] = vec2(nx, ny);
	}
	this.vertices[361] = this.vertices[1];
    };

    this.genCirclePoints();
    this.setColor(c);
}

// pre: 0 <= t0 <= 359, 0 <= dt <= 359, integers
function Bacteria(t, dt, color)
{
    assert(t >= 0 && t <= 359, 'must: 0 <= t <= 359');
    assert(dt >= 0 && dt <= 359, 'must: 0 <= dt <= 359');
    assert((typeof t === 'number') && Math.floor(t) === t, 'must: t is integer');
    assert((typeof dt === 'number') && Math.floor(dt) === dt, 'must: dt is integer');

    GameObj.call(this);
    this.theta = t;
    this.dt = dt;
    this.drawMode = gl.TRIANGLE_STRIP;

    this.genPoints = function() {
	if (this.vertices.length != 31 * 2) {
	    this.vertices = new Array(31 * 2);
	}
	for (var t = -maxDt, i = 0; t <= maxDt; t++, i += 2) {
	    var tr = t * Math.PI / 180; // degrees to radians
	    var p1x = rCrustInner * Math.cos(tr);
	    var p1y = rCrustInner * Math.sin(tr);
	    var p2x = rCrustOuter * Math.cos(tr);
	    var p2y = rCrustOuter * Math.sin(tr);
	    this.vertices[i] = vec2(p1x, p1y);
	    this.vertices[i+1] = vec2(p2x, p2y);
	}
    };

    this.genPoints();

    this.rotate = function(t) {
	this.t = t;
    };

    this.grow = function(dt) {
	// grow this.dt to dt, and update visible buffer section
    };

    this.setColor = function(c) {
	this.color = c;
	if (this.colors.length != this.vertices.length) {
	    this.colors = new Array(this.vertices.length);
	}
	for (var i = 0; i < this.colors.length; i++) {
	    this.colors[i] = c;
	}
    };

    this.rotate(t, dt);
    this.setColor(color);
}

/**
 * Return the positive remainder of dividend and positive divisor.
 */
function rd_rem(dividend, divisor)
{
    var r = dividend % divisor;
    if (r < 0) {
	r += divisor;
    }
    return r;
}

// divisor is the size of the cycle list.
// pair is of this form [a, b], that references the section from na to nb
// in the cycle list.
//
// This function transform pair and return a new pair that uses positive index
// to reference the elements in the cycle list.
function rd_pair_rem(pair, divisor)
{
    var a = rd_rem(pair[0], divisor);
    var b = rd_rem(pair[1], divisor);
    return [a, b];
}

function rd_gen_ranges(pair, divisor)
{
    var a = pair[0];
    var b = pair[1];
    var lst = [];
    var i = a;
    if (a < b) {
	lst.push(pair);
    }
    else if (a > b) {
	lst.push([a, divisor]);
	lst.push([0, b]);
    }
    else if (a == b) {
	lst.push(pair);
    }
    return lst;
}

function xy_to_polar(x, y)
{
    var theta = Math.atan(y / x);
    if ((y > 0 && x < 0) || (y < 0 && x < 0)) {
	theta += Math.PI;
    }
    if (theta < 0) {
	theta += Math.PI * 2;
    }
    var r = Math.sqrt(Math.pow(x, 2) + Math.pow(y, 2));
    return [r, theta];
}

// theta1 and theta2 are in degrees
// pre: r1 <= r2
// pre: no matter who is larger, theta1 is the beginning of the range, theta2
//      is the end of the range.
function isInBacteria(point, r1, r2, theta1, theta2)
{
    var r = point[0];
    var t = 180 * point[1] / Math.PI; // degrees
    console.log(r, t, r1, r2, theta1, theta2);
    return (r >= r1 && r <= r2) && (t >= theta1 && t <= theta2);
}
