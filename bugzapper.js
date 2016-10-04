var canvas;
var gl;
var program;
var vertices = [];
var index = [];
var colors = [];
var vertexBuffer = null;
var colorBuffer = null;
var indexBuffer = null;
var numPoints = 100; // number of points per circle
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

window.onload = function init()
{
    canvas = document.getElementById("gl-canvas");

    gl = WebGLUtils.setupWebGL(canvas);
    if (!gl) { alert("WebGL isn't available"); }

    //
    //  Initialize our data for the disc and bacteria
    //

    // First, initialize the vertices of our 3D gasket

    var disc = new Circle(vec3(0.0, 0.0, 0.0), // center coordinates
			  0.8,		       // radius
			  7,		       // color index for baseColors
			  0);		       // z
    addObject(disc);
    var intervalID = window.setInterval(genBacteria, 100, disc);

    //
    //  Configure WebGL
    //
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.enable(gl.DEPTH_TEST);

    //  Load shaders and initialize attribute buffers

    program = initShaders(gl, "vertex-shader", "fragment-shader");
    gl.useProgram(program);

    // Load the data into the GPU

    // vertex coordinates

    vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(vertices), gl.STATIC_DRAW);

    var vPosition = gl.getAttribLocation(program, "vPosition");
    gl.vertexAttribPointer(vPosition, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vPosition);

    // vertex color

    colorBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(colors), gl.STATIC_DRAW);

    var vColor = gl.getAttribLocation(program, "vColor");
    gl.vertexAttribPointer(vColor, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vColor);

    // element index

    indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(index), gl.STATIC_DRAW);

    render();
};


function render()
{
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(vertices), gl.STATIC_DRAW);
    var vPosition = gl.getAttribLocation(program, "vPosition");
    gl.vertexAttribPointer(vPosition, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vPosition);

    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(colors), gl.STATIC_DRAW);
    var vColor = gl.getAttribLocation(program, "vColor");
    gl.vertexAttribPointer(vColor, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vColor);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(index), gl.STATIC_DRAW);

    gl.drawElements(gl.TRIANGLES, index.length, gl.UNSIGNED_SHORT, 0);

    window.requestAnimFrame(render);
}

/**
 * Generate circle points
 */
// center is a vec3
function genCirclePoints(center, r, az) {
    var newCenter = center;
    newCenter[2] = az;
    var pv = [newCenter];
    var d = Math.PI * (360 / numPoints) / 180;
    for (var theta = 0; theta < 2 * Math.PI && pv.length <= numPoints; theta += d) {
	var x = center[0] + r * Math.cos(theta);
	var y = center[1] + r * Math.sin(theta);
	var z = az;
	pv.push(vec3(x, y, z));
    }
    return pv;
}

function genCircleIndex(pv) {
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

// center is a vec3, radius is a float
function Circle(center, radius, colorIndex, az) {
    this.x = center[0];
    this.y = center[1];
    this.r = radius;
    this.points = genCirclePoints(center, radius, az); // points on the peripheral
    this.index = genCircleIndex(this.points);
    this.color = new Array(this.points.length);
    for (var i = 0; i < this.points.length; i++) {
	this.color[i] = baseColors[colorIndex];
    }
}

function concatIndex(a, b) {
    if (a.length > 1) {
	var d = a[a.length - 2] + 1; // TODO: change
	for (var i = 0; i < b.length; i++) {
	    b[i] += d;
	}
    }
    return Array.prototype.concat.apply(a, b);
}

// This function modifies global variables!
function addObject(obj) {
    vertices = vertices.concat(obj.points);
    index = concatIndex(index, obj.index);
    colors = colors.concat(obj.color);
    // console.log(vertices);
    // console.log(index);
    // console.log(colors);
}

function genBacteria(disc) {
    if (bactIndex < maxBacts) {
	var i1 = bactIndex;
	var b1 = new Circle(disc.points[bactIndex], 0.05, 8, -1);
	addObject(b1);
	bactIndex++;
    }
}
