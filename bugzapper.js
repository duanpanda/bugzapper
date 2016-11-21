var canvas;
var gl;
var prg;
const RADIAN_TO_DEGREE = 180 / Math.PI;
const DEGREE_TO_RADIAN = Math.PI / 180;

var numTimesToSubdivide = 3;
var updateLightPosition = false;

var near = 0.2;
var far = 5000;
var radius = 1.5;
var theta = 0.0;
var phi = 0.0;
var dr = 5.0 * Math.PI/180.0;
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

var eye;
var at = vec3(0.0, 0.0, 0.0);
var up = vec3(0.0, 1.0, 0.0);

const CAMERA_ORBIT_TYPE = 1;
const CAMERA_TRACKING_TYPE = 2;

function mat4_inverse(a,b){b||(b=a);var c=a[0],d=a[1],e=a[2],g=a[3],f=a[4],h=a[5],i=a[6],j=a[7],k=a[8],l=a[9],n=a[10],o=a[11],m=a[12],p=a[13],r=a[14],s=a[15],A=c*h-d*f,B=c*i-e*f,t=c*j-g*f,u=d*i-e*h,v=d*j-g*h,w=e*j-g*i,x=k*p-l*m,y=k*r-n*m,z=k*s-o*m,C=l*r-n*p,D=l*s-o*p,E=n*s-o*r,q=A*E-B*D+t*C+u*z-v*y+w*x;if(!q)return null;q=1/q;b[0]=(h*E-i*D+j*C)*q;b[1]=(-d*E+e*D-g*C)*q;b[2]=(p*w-r*v+s*u)*q;b[3]=(-l*w+n*v-o*u)*q;b[4]=(-f*E+i*z-j*y)*q;b[5]=(c*E-e*z+g*y)*q;b[6]=(-m*w+r*t-s*B)*q;b[7]=(k*w-n*t+o*B)*q;b[8]=(f*D-h*z+j*x)*q;b[9]=(-c*D+d*z-g*x)*q;b[10]=(m*v-p*t+s*A)*q;b[11]=(-k*v+l*t-o*A)*q;b[12]=(-f*C+h*y-i*x)*q;b[13]=(c*C-d*y+e*x)*q;b[14]=(-m*u+p*B-r*A)*q;b[15]=(k*u-l*B+n*A)*q;return b;};
function mat4_multiplyVec4(a,b,c){c||(c=b);var d=b[0],e=b[1],g=b[2],b=b[3];c[0]=a[0]*d+a[4]*e+a[8]*g+a[12]*b;c[1]=a[1]*d+a[5]*e+a[9]*g+a[13]*b;c[2]=a[2]*d+a[6]*e+a[10]*g+a[14]*b;c[3]=a[3]*d+a[7]*e+a[11]*g+a[15]*b;return c;};

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
    this.ambient = sphereAmbient;
    this.diffuse = sphereDiffuse;
    this.specular = sphereSpecular;
    this.shininess = sphereShininess;

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
    this.setLights = function() {
	gl.uniform4fv(prg.uMaterialAmbient, this.ambient);
	gl.uniform4fv(prg.uMaterialDiffuse, this.diffuse);
	gl.uniform4fv(prg.uMaterialSpecular, this.specular);
	gl.uniform1f(prg.uShininess, this.shininess);
    };
}

function initTransforms() {
    cMatrix = mat4();
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
    var sphere = new Sphere();
    Scene.addObj(sphere);
}

window.onload = function init() {
    canvas = document.getElementById("gl-canvas");

    gl = WebGLUtils.setupWebGL(canvas);
    if (!gl ) { alert( "WebGL isn't available"); }

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
	Scene.objects.pop();
	init();
    };
    document.getElementById("Button7").onclick = function(){
	if (numTimesToSubdivide > 0) {
	    numTimesToSubdivide--;
	}
	Scene.objects.pop();
	init();
    };
    document.getElementById("Button8").onclick = toggleLight;

    render();
};

function render() {
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    updateTransforms();
    setMatrixUniforms();
    gl.uniform1i(prg.uUpdateLight, updateLightPosition);
    for (var i = 0; i < Scene.objects.length; i++) {
	var obj = Scene.objects[i];
	obj.setLights();
	obj.redraw();
    }

    requestAnimFrame(render);
}

function updateTransforms() {
    theta += 0.02;
    // phi += 0.01;
    // radius += 0.01;
    eye = vec3(radius*Math.sin(theta)*Math.cos(phi),
	       radius*Math.sin(theta)*Math.sin(phi), radius*Math.cos(theta));
    // at[0] += 0.005;
    mvMatrix = lookAt(eye, at, up);
    // if (fovy < 180) {
    // 	fovy += 0.1;
    // 	console.log(fovy);
    // }
    pMatrix = perspective(fovy, canvas.width / canvas.height, near, far);
}

function setMatrixUniforms() {
    gl.uniformMatrix4fv(prg.uMVMatrix, false, flatten(mvMatrix));
    gl.uniformMatrix4fv(prg.uPMatrix, false, flatten(pMatrix));
    // cMatrix = mat4_inverse(mvMatrix);
    // nMatrix = transpose(cMatrix);
    nMatrix = mvMatrix;	      // no scaling in this application, so simplify it
    gl.uniformMatrix4fv(prg.uNMatrix, false, flatten(nMatrix));
}

function Camera(type) {
    this.matrix = mat4();
    this.up = vec3();
    this.right = vec3();
    this.normal = vec3();
    this.home = vec3.create();
    this.azimuth = 0.0;
    this.elevation = 0.0;
    this.type = type;
    this.steps = 0;
    this.hookRenderer = null;
    this.hookGUIUpdate = null;
}

Camera.prototype.setType = function(t){
    this.type = t;
    if (t != CAMERA_ORBIT_TYPE && t != CAMERA_TRACKING_TYPE) {
	alert('Wrong Camera Type!. Setting Orbitting type by default');
	this.type = CAMERA_ORBIT_TYPE;
    }
};

Camera.prototype.goHome = function(h){
    if (h != null) {
	this.home = h;
    }
    this.setPosition(this.home);
    this.setAzimuth(0);
    this.setElevation(0);
    this.steps = 0;
};

Camera.prototype.dolly = function(s){
    var c = this;
    var p = vec3();
    var n = vec3();
    p = c.position;
    var step = s - c.steps;
    n = normalize(c.normal);
    var newPosition = vec3();

    if(c.type == CAMERA_TRACKING_TYPE){
	newPosition[0] = p[0] - step*n[0];
	newPosition[1] = p[1] - step*n[1];
	newPosition[2] = p[2] - step*n[2];
    } else{
	newPosition[0] = p[0];
	newPosition[1] = p[1];
	newPosition[2] = p[2] - step;
    }

    c.setPosition(newPosition);
    c.steps = s;
};

Camera.prototype.setPosition = function(p){
    this.position = vec3(p);
    this.update();
};

Camera.prototype.setAzimuth = function(az){
    this.changeAzimuth(az - this.azimuth);
};

Camera.prototype.changeAzimuth = function(az){
    var c = this;
    c.azimuth +=az;
    if (c.azimuth > 360 || c.azimuth <-360) {
	c.azimuth = c.azimuth % 360;
    }
    c.update();
};

Camera.prototype.setElevation = function(el){
    this.changeElevation(el - this.elevation);
};

Camera.prototype.changeElevation = function(el){
    var c = this;
    c.elevation +=el;
    if (c.elevation > 360 || c.elevation <-360) {
	c.elevation = c.elevation % 360;
    }
    c.update();
};

Camera.prototype.update = function(){
    if (this.type == CAMERA_TRACKING_TYPE){
	var I = mat4();	// identity
	var T = translate(this.position[0], this.position[1], this.position[2]);
	var RY = rotate(this.azimuth * DEGREE_TO_RADIAN, [0, 1, 0]);
	var RX = rotate(this.elevation * DEGREE_TO_RADIAN, [1, 0, 0]);
	this.matrix = mult(mult(mult(I, T), RY), RX);
    }
    else {
	I = mat4();
	T = translate(this.position[0], this.position[1], this.position[2]);
	RY = rotate(this.azimuth * DEGREE_TO_RADIAN, [0, 1, 0]);
	RX = rotate(this.elevation * DEGREE_TO_RADIAN, [1, 0, 0]);
	this.matrix = mult(mult(mult(I, RY), RX, T));
    }

    var m = this.matrix;
    mat4_multiplyVec4(m, [1, 0, 0, 0], this.right);
    mat4_multiplyVec4(m, [0, 1, 0, 0], this.up);
    mat4_multiplyVec4(m, [0, 0, 1, 0], this.normal);

    /**
    * We only update the position if we have a tracking camera.
    * For an orbiting camera we do not update the position. If
    * you don't believe me, go ahead and comment the if clause...
    * Why do you think we do not update the position?
    */
    if(this.type == CAMERA_TRACKING_TYPE){
	mat4_multiplyVec4(m, [0, 0, 0, 1], this.position);
    }

    //console.info('------------- update -------------');
    //console.info(' right: ' + vec3.str(this.right)+', up: ' + vec3.str(this.up)+',normal: ' + vec3.str(this.right));
    //console.info('   pos: ' + vec3.str(this.position));
    //console.info('   azimuth: ' + this.azimuth +', elevation: '+ this.elevation);
    if(this.hookRenderer){
	this.hookRenderer();
    }
    if(this.hookGUIUpdate){
	this.hookGUIUpdate();
    }
};

Camera.prototype.getViewTransform = function(){
    var m = mat4();
    mat4_inverse(this.matrix, m);
    return m;
};

function toggleLight() {
    updateLightPosition = !updateLightPosition;
}
