var canvas;
var gl;
var vertices;
var index;

var numPoints = 100;

window.onload = function init()
{
    canvas = document.getElementById("gl-canvas");

    gl = WebGLUtils.setupWebGL(canvas);
    if (!gl) { alert("WebGL isn't available"); }

    //
    //  Initialize our data for the disc and bacteria
    //

    // First, initialize the vertices of our 3D gasket

    vertices = genCirclePoints(0.0, 0.0, 0.8);
    console.log(vertices);

    index = genCircleIndice();
    console.log(index);


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
function genCirclePoints(x0, y0, r) {
    pv = [vec3(x0,y0,0)];
    d = Math.PI * (360 / numPoints) / 180;
    for (theta = 0; theta < 2 * Math.PI; theta += d) {
	x = x0 + r * Math.cos(theta);
	y = y0 + r * Math.sin(theta);
	z = 0.0;
	pv.push(vec3(x, y, z));
    }
    return pv;
}

function genCircleIndice() {
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
