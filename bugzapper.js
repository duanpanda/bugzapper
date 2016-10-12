var canvas;
var gl;
var program;

var indices = [];
var colors = [];
var vertexBuffer = null;
var colorBuffer = null;
var indexBuffer = null;
var numPoints = 80; // number of points per circle
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

var bactIndex = 1;
var maxBacts = numPoints + 1;

var maxNumTriangles = 5000;
var maxNumVertices = 3 * maxNumTriangles;
var vertexBufferSize = Float64Array.BYTES_PER_ELEMENT * 2 * maxNumVertices;
var colorBufferSize = vertexBufferSize;
var indexBufferSize = Uint16Array.BYTES_PER_ELEMENT * 3 * maxNumVertices;

var thetaList = [];
var vertices = [];
var intension = 0;
var rDisk = 0.7;
var rCrustInner = 0.702;
var rCrustOuter = 0.8;
var diskIndice = [];
var bacteriaThetas = [];
var bacteriaIndice = [];
var diskColorIndex = 7;
var bacteriaColorIndex = 1;

var bTheta = 50;
var bDelta = 10;

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

    // Load the data into the GPU

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

    render();
};

function initObjData()
{
    thetaList = genGlobalThetaList(0);
    vertices = genAllVertices(thetaList, rDisk, rCrustInner, rCrustOuter);
    diskIndice = genDiskTriangles(thetaList, vertices);
    bacteriaThetas = genBacteriaThetaList(bTheta, bDelta);
    bacteriaIndice = genBacteriaTriangles(bacteriaThetas);
    colors = new Array(vertices.length);
    for (var i = 0; i < vertices.length; i++) {
	colors[i] = baseColors[0];
    }
    colors = setDiskColor(colors, diskIndice, baseColors, diskColorIndex);
    colors = setBacteriaColor(colors, bacteriaIndice, baseColors, bacteriaColorIndex);
    addObj(diskIndice);
    addObj(bacteriaIndice);
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
    var table = [{n:360, d:1}, {n:180, d:2}, {n:90, d:3}];
    var n = table[intension].n;
    var d = table[intension].d;	// delta in radians
    for (var i = 0; i < n; i = i + d) {
	t.push(i);
    }
    return t;
}

/**
 * Generate all vertices that are used in this program.
 * Put the origin point to the end.
 * Return a vec2 list.
 */
function genAllVertices(thetaList, r1, r2, r3)
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
 * Return an theta index list.
 * The index references the elements of global thetaList.
 * t0 is the central angle, dt is the angle that expands from t0 to clockwise
 * direction and anti-clockwise direction.
 *
 * pre: 0 <= t0 <= 359, 0 <= dt <= 359
 * post: the length of the returned list must be an odd number.
 */
function genBacteriaThetaList(t0, dt)
{
    var t1 = (t0 - dt) % 360;
    var t2 = (t0 + dt) % 360;
    var begin = thetaList.indexOf(t1);
    var end = thetaList.indexOf(t2);
    var lst = [];
    for (var i = begin; i <= end; i++) {
	lst.push(i);
    }
    return lst;
}

/**
 * Return an index list.  The index references the elements in vertex list.
 * ts is a theta index list.
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
    // for (var i = 0; i < vertexIndice.length; i++) {
    // 	inout_colors[vertexIndice[i]] = baseColors[colorIndex];
    // }
    vertexIndice.forEach(function(item, i, array) {
	inout_colors[item] = baseColors[colorIndex];
    });
    return inout_colors;
}

function setBacteriaColor(inout_colors, vertexIndice, baseColors, colorIndex)
{
    // for (var i = 0; i < vertexIndice.length; i++) {
    // 	inout_colors[vertexIndice[i]] = baseColors[colorIndex];
    // }
    vertexIndice.forEach(function(item, i, array) {
	inout_colors[item] = baseColors[colorIndex];
    });
    return inout_colors;
}

/**
 * Generate circle points
 */
// center is a vec2
function genCirclePoints(center, r)
{
    var pv = [center];
    var d = Math.PI * (360 / numPoints) / 180;
    for (var theta = 0; theta < 2 * Math.PI && pv.length <= numPoints; theta += d) {
	var x = center[0] + r * Math.cos(theta);
	var y = center[1] + r * Math.sin(theta);
	pv.push(vec2(x, y));
    }
    return pv;
}

function genCircleIndex(pv)
{
    var iv = [];
    for (var i = 1; i < pv.length - 1; i++) {
	iv.push(0);
	iv.push(i);
	iv.push(i+1);
    }
    iv.push(0);
    iv.push(i);
    iv.push(1);
    return iv;
}

// center is a vec2, radius is a float
function Circle(center, radius, colorIndex)
{
    this.x = center[0];
    this.y = center[1];
    this.r = radius;
    this.points = genCirclePoints(center, radius); // points on the peripheral
    this.indices = genCircleIndex(this.points);
    this.color = new Array(this.points.length);
    for (var i = 0; i < this.points.length; i++) {
	this.color[i] = baseColors[colorIndex];
    }
}

function concatIndex(a, b)
{
    if (a.length > 1) {
	var d = a[a.length - 2] + 1; // TODO: change
	for (var i = 0; i < b.length; i++) {
	    b[i] += d;
	}
    }
    return Array.prototype.concat.apply(a, b);
}

// This function modifies global variables!
function addObject(obj)
{
    vertices = vertices.concat(obj.points);
    indices = concatIndex(indices, obj.indices);
    colors = colors.concat(obj.color);
    updateGLBuffers();
}

function addObj(indexList)
{
    indices = indices.concat(indexList);
    updateGLBuffers();
}

function genBacteria(disk)
{
    if (bactIndex < maxBacts) {
	var i1 = bactIndex;
	var b1 = new Circle(disk.points[bactIndex], 0.05, 8);
	addObject(b1);
	bactIndex++;
    }
}
