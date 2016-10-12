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
var rDisc = 0.7;
var rCrustInner = 0.71;
var rCrustOuter = 0.8;

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
    //  Initialize our data for the disc and bacteria
    //

    // var disc = new Circle(vec2(0.0, 0.0), // center coordinates
    // 			  0.8,		  // radius
    // 			  7);		  // color index for baseColors
    // addObject(disc);
    // var intervalID = window.setInterval(genBacteria, 100, disc);

    // render();
    thetaList = genGlobalThetaList(0);
    console.log(thetaList);
    vertices = genAllVertices(thetaList, rDisc, rCrustInner, rCrustOuter);
    console.log(vertices);
};

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
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);

    window.requestAnimFrame(render);
}

/**
 * Generate a theta list that maps to all the vertices.
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
	var p1x = r1 * Math.cos(theta);
	var p1y = r1 * Math.sin(theta);
	var p2x = r2 * Math.cos(theta);
	var p2y = r2 * Math.sin(theta);
	var p3x = r3 * Math.cos(theta);
	var p3y = r3 * Math.sin(theta);
	t.push(vec2(p1x, p1y));
	t.push(vec2(p2x, p2y));
	t.push(vec2(p3x, p3y));
    });
    return t;
}

function genDiscTriangles()
{
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
    console.log(vertices);
    console.log(indices);
    updateGLBuffers();
}

function genBacteria(disc)
{
    if (bactIndex < maxBacts) {
	var i1 = bactIndex;
	var b1 = new Circle(disc.points[bactIndex], 0.05, 8);
	addObject(b1);
	bactIndex++;
    }
}
