var canvas;
var gl;
var vertices;
var index;
var numPoints = 50; // number of points per circle

window.onload = function init()
{
    canvas = document.getElementById("gl-canvas");

    gl = WebGLUtils.setupWebGL(canvas);
    if (!gl) { alert("WebGL isn't available"); }

    //
    //  Initialize our data for the disc and bacteria
    //

    // First, initialize the vertices of our 3D gasket

    var disc = new Circle(vec3(0.0, 0.0, 0.0), 0.8);
    var bacteria = new Circle(disc.points[30], 0.2);
    vertices = Array.prototype.concat(disc.points, bacteria.points);
    // console.log(vertices);

    index = concatIndex(disc.index, bacteria.index);
    // console.log(index);


    //
    //  Configure WebGL
    //
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.enable(gl.DEPTH_TEST);

    //  Load shaders and initialize attribute buffers

    var program = initShaders(gl, "vertex-shader", "fragment-shader");
    gl.useProgram(program);

    // Load the data into the GPU

    var vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(vertices), gl.STATIC_DRAW);

    // Associate out shader variables with our data buffer

    var vPosition = gl.getAttribLocation( program, "vPosition" );
    gl.vertexAttribPointer(vPosition, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vPosition);

    // Bind Element Array
    var indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(index), gl.STATIC_DRAW);

    render();
};


function render()
{
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    // gl.drawArrays(gl.POINTS, 0, vertices.length);
    gl.drawElements(gl.TRIANGLES, index.length, gl.UNSIGNED_SHORT, 0);
}

/**
 * Generate circle points
 */
function genCirclePoints(center, r) { // center is a vec3
    pv = [center];
    d = Math.PI * (360 / numPoints) / 180;
    for (theta = 0; theta < 2 * Math.PI; theta += d) {
	x = center[0] + r * Math.cos(theta);
	y = center[1] + r * Math.sin(theta);
	z = 0.0;
	pv.push(vec3(x, y, z));
    }
    return pv;
}

function genCircleIndex() {
    iv = [];
    for (i = 1; i < numPoints; i++) {
	iv.push(0);
	iv.push(i);
	iv.push(i+1);
    }
    iv.push(0);
    iv.push(i);
    iv.push(1);
    return iv;
}

function Circle(center, radius) { // center is a vec3, radius is a float
    this.x = center[0];
    this.y = center[1];
    this.r = radius;
    this.points = genCirclePoints(center, radius); // points on the peripheral
    this.index = genCircleIndex();
}

function concatIndex(a, b) {
    d = a.length / 3 + 1;
    for (i = 0; i < b.length; i++) {
	b[i] += d;
    }
    return Array.prototype.concat.apply(a, b);
}
