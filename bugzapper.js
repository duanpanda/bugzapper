var canvas;
var gl;
var program;

var vertexBuffer = null;
var colorBuffer = null;
var indexBuffer = null;

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
var vertexBufferSize = Float64Array.BYTES_PER_ELEMENT * 2 * maxNumVertices;
var colorBufferSize = vertexBufferSize;
var indexBufferSize = Uint16Array.BYTES_PER_ELEMENT * 3 * maxNumVertices;

// The following resources are shared among the disk and all the bacterias.
var thetaList = [];
var vertices = [];
var indices = [];
var colors = [];

// attributes that configure the game and the game objects
var intension = 0;		// now only 0 works
var rDisk = 0.7;
var rCrustInner = rDisk;
var rCrustOuter = 0.8;
var diskColorIndex = 7;
var bacteriaColorIndex = 8;
var bac2ColorIndex = 6;
var bTheta = 0;
var bDelta = 1;

// game objects
var diskObj = null;
var bacteriaList = [];

var diskIndice = [];
var bacteriaThetas = [];
var bacteriaIndice = [];
var bac2Thetas = [];
var bac2Indice = [];

var intervalId = 0;

window.onload = function init()
{
    canvas = document.getElementById("gl-canvas");

    gl = WebGLUtils.setupWebGL(canvas);
    if (!gl) { alert("WebGL isn't available"); }

    //
    //  Configure WebGL
    //
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.0, 0.0, 0.0, 1.0);

    //  Load shaders and initialize attribute buffers

    program = initShaders(gl, "vertex-shader", "fragment-shader");
    gl.useProgram(program);

    // Allocate VBOs in GPU and set Attributes to point to VBOs

    // vertex coordinates

    vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertexBufferSize, gl.STATIC_DRAW);

    var vPosition = gl.getAttribLocation(program, "vPosition");
    gl.vertexAttribPointer(vPosition, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vPosition);

    // vertex color

    colorBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, colorBufferSize, gl.STATIC_DRAW);

    var vColor = gl.getAttribLocation(program, "vColor");
    gl.vertexAttribPointer(vColor, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vColor);

    // element indices

    indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indexBufferSize, gl.STATIC_DRAW);

    //
    //  Initialize our data for the disk and bacteria
    //

    initObjData();

    updateGLBuffers();

    render();
};

function initObjData()
{
    thetaList = genGlobalThetaList(intension);
    vertices = genGlobalVertices(thetaList, rDisk, rCrustInner, rCrustOuter);
    indices = genGlobalIndice();
    colors = genGlobalColorBuffer();
    clearGlobalColorBuffer();
    colors = setDiskColor(colors, diskIndice, baseColors, diskColorIndex);
    colors = setBacteriaColor(colors, bacteriaIndice, baseColors, bacteriaColorIndex);
    // invervalId = window.setInterval(updateGame, 150);
}

function updateGame()
{
    bDelta++;
    if (bDelta > 15) {
	window.clearInterval(intervalId);
	return;
    }
    bacteriaThetas = genBactThetaIndexList(bTheta, bDelta);
    bacteriaIndice = genBacteriaTriangles(bacteriaThetas);
    var bTheta2 = bTheta + 10;
    bac2Thetas = genBactThetaIndexList(bTheta2, bDelta);
    bac2Indice = genBacteriaTriangles(bac2Thetas);
    clearGlobalColorBuffer();
    colors = setDiskColor(colors, diskIndice, baseColors, diskColorIndex);
    colors = setBacteriaColor(colors, bacteriaIndice, baseColors, bacteriaColorIndex);
    colors = setBacteriaColor(colors, bac2Indice, baseColors, bac2ColorIndex);
    indices = [];
    addObj2(diskIndice);
    addObj2(bacteriaIndice);
    addObj2(bac2Indice);
}

function updateGLBuffers()
{
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, flatten(vertices));

    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, flatten(colors));

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferSubData(gl.ELEMENT_ARRAY_BUFFER, 0, new Uint16Array(indices));
}

function render()
{
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);
    window.requestAnimFrame(render);
}

/**
 * Generate a theta list that maps to all the vertices.
 * In Degrees.
 *
 * intension := 0 or 1 or 2
 * If intension == 0, generate 360 angles, which is 360 thetas.
 * If intension == 1, generate 360 / 2 = 180 angles, which is 180 thetas.
 * If intension == 2, generate 360 / 2 / 2 = 90 angles, which is 90 thetas.
 */
function genGlobalThetaList(intension)
{
    var t = [];
    var table = [{n:360, d:1}, {n:180, d:2}, {n:90, d:4}];
    var n = table[intension].n;
    var d = table[intension].d;	// delta in radians
    for (var i = 0; i < 360; i = i + d) {
	t.push(i);
    }
    assert(t.length == n, 't.length:' + t.length + ' must == n:' + n);
    return t;
}

/**
 * Generate all vertices that are used in this program.
 * Put the origin point to the end.
 * Return a vec2 list.
 */
function genGlobalVertices(thetaList, r1, r2, r3)
{
    var t = [];
    thetaList.forEach(function(theta, index, array) {
	var ra = theta * Math.PI / 180; // degrees to radians
	var p1x = r1 * Math.cos(ra);
	var p1y = r1 * Math.sin(ra);
	var p2x = r2 * Math.cos(ra);
	var p2y = r2 * Math.sin(ra);
	var p3x = r3 * Math.cos(ra);
	var p3y = r3 * Math.sin(ra);
	t.push(vec2(p1x, p1y));
	t.push(vec2(p2x, p2y));
	t.push(vec2(p3x, p3y));
    });
    t.push(vec2(0.0, 0.0));
    return t;
}

function genGlobalIndice()
{
    diskIndice = genDiskTriangles(thetaList, vertices);
    bacteriaIndice = genBacteriaTriangles(thetaList.concat([0]));
    return indices = diskIndice.concat(bacteriaIndice);
}

function genGlobalColorBuffer()
{
    return colors = new Array(vertices.length);
}

function clearGlobalColorBuffer()
{
    for (var i = 0; i < vertices.length; i++) {
	colors[i] = baseColors[0];
    }
}

/**
 * Return an index list.  The index references the elements in the vertex list.
 */
function genDiskTriangles(thetaList, vertices)
{
    var p = [];
    var originIndex = vertices.length - 1;
    for (var i = 0; i < thetaList.length - 1; i++) {
	var j = 3 * i;
	p.push(originIndex);
	p.push(j);		// 3*i
	p.push(j+3);		// 3*(i+1)
    }
    p.push(originIndex);
    p.push(3 * i);
    p.push(0);
    return p;
}

/**
 * In the global thetaList, find the best matched one, and return its index.
 */
function getMatchedThetaIndex(t)
{
    var index = thetaList.indexOf(t);
    if (index == -1) {
	// not found
	// TODO
    }
    return index;
}

/**
 * Return an theta range: from thetaBegin to thetaEnd.
 * pre: 0 <= t0 <= 359, 0 <= dt <= 359, integers
 */
function genBactThetaRange(t0, dt)
{
    assert(t0 >= 0 && t0 <= 359, 'must: 0 <= t0 <= 359');
    assert(dt >= 0 && dt <= 359, 'must: 0 <= dt <= 359');
    assert((typeof t0 === 'number') && Math.floor(t0) === t0, 'must: t0 is integer');
    assert((typeof dt === 'number') && Math.floor(dt) === dt, 'must: dt is integer');
    var t1 = (t0 - dt) % 360;
    if (t1 < 0) {
	t1 += 360;
    }
    var t2 = (t0 + dt) % 360;
    return {thetaBegin:t1, thetaEnd:t2};
}

function getThetaIndexPair(t1, t2)
{
    var begin = getMatchedThetaIndex(thetaBegin);
    var end = getMatchedThetaIndex(thetaEnd);
    return {begin:begin, end:end};
}

/**
 * Return an theta index list.
 * The input are indices that reference the elements of global thetaList.
 *
 * post: the length of the returned list must be an odd number.
 */
function genBactThetaIndexList(begin, end)
{
    var lst = [];
    // 'begin' can be larger than 'end'.
    var i = begin;
    if (begin < end) {
	for (i = begin; i <= end; i++) {
	    lst.push(i);
	}
    }
    else if (begin > end) {
	for (i = begin; i < 360; i++) {
	    lst.push(i);
	}
	for (i = 0; i <= end; i++) {
	    lst.push(i);
	}
    }
    else if (begin == end) {
	lst.push(begin);
    }
    assert(lst.length % 2 == 1, 'lst.length:' + lst.length + ' must be an odd number');
    return lst;
}

/**
 * Return an index list.  The index references the elements in vertex list.
 * ts is a theta index list that references the global theta list.
 */
function genBacteriaTriangles(ts)
{
    var p = [];
    for (var i = 0; i <= ts.length - 3; i += 2) {
	var a = 3 * ts[i] + 1;
	var b = 3 * ts[i] + 2;
	var c = 3 * ts[i+1] + 1;
	var d = 3 * ts[i+1] + 2;
	var e = 3 * ts[i+2] + 1;
	var f = 3 * ts[i+2] + 2;
	p.push(a); p.push(d); p.push(b);
	p.push(a); p.push(c); p.push(d);
	p.push(c); p.push(f); p.push(d);
	p.push(c); p.push(e); p.push(f);
    }
    return p;
}

function setDiskColor(inout_colors, vertexIndice, baseColors, colorIndex)
{
    vertexIndice.forEach(function(item, i, array) {
	inout_colors[item] = baseColors[colorIndex];
    });
    return inout_colors;
}

function setBacteriaColor(inout_colors, vertexIndice, baseColors, colorIndex)
{
    vertexIndice.forEach(function(item, i, array) {
	inout_colors[item] = baseColors[colorIndex];
    });
    return inout_colors;
}

function addObj2(indexList)
{
    indices = indices.concat(indexList);
    updateGLBuffers();
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

/**
 * GameObj is a special pointer to the global indice[]
 * which contains a set of triples that consists triangles.
 * Each GameObj points to a subset of indice[], which means
 * that subset belongs to this GameObj.
 *
 * indexBegin is the index at the beginning of the subset. (included)
 * indexEnd is the index at the end of the subset. (included)
 */
function GameObj(indexBegin, indexEnd)
{
    this.indexBegin = indexBegin;
    this.indexEnd = indexEnd;
}

function Bacteria(t, dt)
{
    var rangePair = genBactThetaRange(t, dt);
    this.thetaBegin = rangePair.thetaBegin;
    this.thetaEnd = rangePair.thetaEnd;

    var indexPair = getThetaIndexPair(this.thetaBegin, this.thetaEnd);
    var thetaIndexList = genBactThetaIndexList(indexPair.begin, indexPair.end);
    this.vIndexBegin = 0;
    this.vIndexEnd = 0;
}

function addBacteria(obj)
{
    bacteriaList.push(obj);
}
