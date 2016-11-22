function SceneTransforms(c){
    this.stack = [];
    this.camera = c;
    this.mvMatrix = mat4();	// The Model-View matrix
    this.pMatrix = mat4();	// The projection matrix
    this.nMatrix = mat4();	// The normal matrix
    this.cMatrix = mat4();	// The camera matrix
};

SceneTransforms.prototype.calculateModelView = function(){
    this.mvMatrix = this.camera.getViewTransform();
};

SceneTransforms.prototype.calculateNormal = function(){
    this.nMatrix = mat4(this.mvMatrix);
    // this.nMatrix = transpose(mat4_inverse(this.nMatrix));
};

SceneTransforms.prototype.calculatePerspective = function(){
    //Initialize Perspective matrix
    this.pMatrix = perspective(30, c_width / c_height, 0.1, 1000.0);
};

SceneTransforms.prototype.init = function(){
    this.calculateModelView();
    this.calculatePerspective();
    this.calculateNormal();
};

SceneTransforms.prototype.updatePerspective = function(){
    // We can resize the screen at any point so the perspective matrix should
    // be updated always.
    this.pMatrix = perspective(30, c_width / c_height, 0.1, 1000.0);
};

// Maps the matrices to shader matrix uniforms
// Called once per rendering cycle.
SceneTransforms.prototype.setMatrixUniforms = function(){
    this.calculateNormal();
    gl.uniformMatrix4fv(prg.uMVMatrix, false, this.mvMatrix);
    gl.uniformMatrix4fv(prg.uPMatrix, false, this.pMatrix);
    gl.uniformMatrix4fv(prg.uNMatrix, false, this.nMatrix);
};

SceneTransforms.prototype.push = function(){
    var memento =  mat4(this.mvMatrix);
    this.stack.push(memento);
};

SceneTransforms.prototype.pop = function(){
    if (this.stack.length == 0) return;
    this.mvMatrix = this.stack.pop();
};
