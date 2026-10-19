/* GLOBAL CONSTANTS AND VARIABLES */

const WIN_Z = 0;  
const WIN_LEFT = 0; const WIN_RIGHT = 1;  
const WIN_BOTTOM = 0; const WIN_TOP = 1;  
const INPUT_TRIANGLES_URL = "https://ncsucgclass.github.io/prog3/triangles.json"; 
const INPUT_ELLIPSOIDS_URL = "https://ncsucgclass.github.io/prog3/ellipsoids.json";
var Eye = new vec4.fromValues(0.5, 0.5, -0.5, 1.0); 

/* webgl globals */
var gl = null; 
var vertexBuffer; 
var normalBuffer; // Buffer for normals
var colorBuffer;  // Buffer for diffuse colors
var triangleBuffer; 
var triBufferSize; 

// Material property buffers or uniforms
var ambientBuffer, specularBuffer, shininessBuffer;

var vertexPositionAttrib; 
var vertexNormalAttrib;
var vertexAmbientAttrib;
var vertexDiffuseAttrib;
var vertexSpecularAttrib;
var vertexShininessAttrib;

// Matrix Uniforms and Objects
var mvMatrixUniform, pMatrixUniform, nMatrixUniform;
var mvMatrix = mat4.create();
var pMatrix = mat4.create();
var nMatrix = mat3.create();

// ASSIGNMENT HELPER FUNCTIONS

function getJSONFile(url,descr) {
    try {
        if ((typeof(url) !== "string") || (typeof(descr) !== "string"))
            throw "getJSONFile: parameter not a string";
        else {
            var httpReq = new XMLHttpRequest(); 
            httpReq.open("GET",url,false); 
            httpReq.send(null); 
            var startTime = Date.now();
            while ((httpReq.status !== 200) && (httpReq.readyState !== XMLHttpRequest.DONE)) {
                if ((Date.now()-startTime) > 3000)
                    break;
            } 
            if ((httpReq.status !== 200) || (httpReq.readyState !== XMLHttpRequest.DONE))
                throw "Unable to open "+descr+" file!";
            else
                return JSON.parse(httpReq.response); 
        } 
    } 
    catch(e) {
        console.log(e);
        return(null);
    }
} 

function setupWebGL() {
    var canvas = document.getElementById("myWebGLCanvas"); 
    gl = canvas.getContext("webgl"); 
    try {
      if (gl == null) {
        throw "unable to create gl context -- is your browser gl ready?";
      } else {
        gl.clearColor(0.0, 0.0, 0.0, 1.0); 
        gl.clearDepth(1.0); 
        gl.enable(gl.DEPTH_TEST); 
      }
    } 
    catch(e) {
      console.log(e);
    } 
} 

// read triangles in, load them into webgl buffers
function loadTriangles() {
    var inputTriangles = getJSONFile(INPUT_TRIANGLES_URL,"triangles");
    if (inputTriangles != null) { 
        var coordArray = []; 
        var normalArray = []; 
        var ambientArray = [];
        var diffuseArray = []; 
        var specularArray = [];
        var shininessArray = [];
        var indexArray = []; 
        var indexOffset = 0; 
        
        for (var whichSet=0; whichSet<inputTriangles.length; whichSet++) {
            var triangleSet = inputTriangles[whichSet];
            var mat = triangleSet.material;
            
            for (var whichSetVert=0; whichSetVert<triangleSet.vertices.length; whichSetVert++){
                coordArray = coordArray.concat(triangleSet.vertices[whichSetVert]);
                normalArray = coordArray.concat(triangleSet.normals[whichSetVert]); // fixed normal extraction below
            }
            
            // Re-correcting normal array loop properly:
            normalArray = [];
            for (var whichSetVert=0; whichSetVert<triangleSet.vertices.length; whichSetVert++){
                coordArray.push(triangleSet.vertices[whichSetVert][0], triangleSet.vertices[whichSetVert][1], triangleSet.vertices[whichSetVert][2]);
                normalArray.push(triangleSet.normals[whichSetVert][0], triangleSet.normals[whichSetVert][1], triangleSet.normals[whichSetVert][2]);
                
                ambientArray.push(mat.ambient[0], mat.ambient[1], mat.ambient[2]);
                diffuseArray.push(mat.diffuse[0], mat.diffuse[1], mat.diffuse[2]);
                specularArray.push(mat.specular[0], mat.specular[1], mat.specular[2]);
                shininessArray.push(mat.n);
            }

            for (var whichSetTri=0; whichSetTri<triangleSet.triangles.length; whichSetTri++) {
                var tri = triangleSet.triangles[whichSetTri];
                indexArray.push(tri[0] + indexOffset, tri[1] + indexOffset, tri[2] + indexOffset);
            }
            
            indexOffset += triangleSet.vertices.length;
        } 
        
        triBufferSize = indexArray.length;

        vertexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(coordArray), gl.STATIC_DRAW);
        
        normalBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normalArray), gl.STATIC_DRAW);

        ambientBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, ambientBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(ambientArray), gl.STATIC_DRAW);

        colorBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(diffuseArray), gl.STATIC_DRAW);

        specularBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, specularBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(specularArray), gl.STATIC_DRAW);

        shininessBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, shininessBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(shininessArray), gl.STATIC_DRAW);

        triangleBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triangleBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indexArray), gl.STATIC_DRAW);
    } 
} 

// setup the webGL shaders with Blinn-Phong per-fragment lighting
function setupShaders() {
    var fShaderCode = `
        precision mediump float;
        
        varying vec3 vPosition;
        varying vec3 vNormal;
        varying vec3 vAmbient;
        varying vec3 vDiffuse;
        varying vec3 vSpecular;
        varying float vShininess;

        void main(void) {
            vec3 lightPosition = vec3(-0.5, 1.5, -0.5);
            vec3 lightColor = vec3(1.0, 1.0, 1.0);

            vec3 N = normalize(vNormal);
            vec3 L = normalize(lightPosition - vPosition);
            vec3 V = normalize(-vPosition); // Assuming camera at origin in eye space
            vec3 H = normalize(L + V);

            // Ambient
            vec3 ambient = vAmbient * lightColor;

            // Diffuse
            float diff = max(dot(N, L), 0.0);
            vec3 diffuse = diff * (vDiffuse * lightColor);

            // Specular (Blinn-Phong)
            float spec = pow(max(dot(N, H), 0.0), vShininess);
            if (diff <= 0.0) spec = 0.0;
            vec3 specular = spec * (vSpecular * lightColor);

            vec3 finalColor = ambient + diffuse + specular;
            gl_FragColor = vec4(finalColor, 1.0);
        }
    `;
    
    var vShaderCode = `
        attribute vec3 vertexPosition;
        attribute vec3 vertexNormal;
        attribute vec3 vertexAmbient;
        attribute vec3 vertexDiffuse;
        attribute vec3 vertexSpecular;
        attribute float vertexShininess;

        uniform mat4 uMVMatrix;
        uniform mat4 uPMatrix;
        uniform mat3 uNMatrix;

        varying vec3 vPosition;
        varying vec3 vNormal;
        varying vec3 vAmbient;
        varying vec3 vDiffuse;
        varying vec3 vSpecular;
        varying float vShininess;

        void main(void) {
            vec4 vertexPositionEye4 = uMVMatrix * vec4(vertexPosition, 1.0);
            vPosition = vertexPositionEye4.xyz / vertexPositionEye4.w;
            
            vNormal = uNMatrix * vertexNormal;
            vAmbient = vertexAmbient;
            vDiffuse = vertexDiffuse;
            vSpecular = vertexSpecular;
            vShininess = vertexShininess;

            gl_Position = uPMatrix * vertexPositionEye4;
        }
    `;
    
    try {
        var fShader = gl.createShader(gl.FRAGMENT_SHADER);
        gl.shaderSource(fShader, fShaderCode);
        gl.compileShader(fShader);

        var vShader = gl.createShader(gl.VERTEX_SHADER);
        gl.shaderSource(vShader, vShaderCode);
        gl.compileShader(vShader);
            
        if (!gl.getShaderParameter(fShader, gl.COMPILE_STATUS)) {
            throw "error during fragment shader compile: " + gl.getShaderInfoLog(fShader);  
        } else if (!gl.getShaderParameter(vShader, gl.COMPILE_STATUS)) {
            throw "error during vertex shader compile: " + gl.getShaderInfoLog(vShader);  
        } else {
            var shaderProgram = gl.createProgram();
            gl.attachShader(shaderProgram, fShader);
            gl.attachShader(shaderProgram, vShader);
            gl.linkProgram(shaderProgram);

            if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
                throw "error during shader program linking: " + gl.getProgramInfoLog(shaderProgram);
            } else {
                gl.useProgram(shaderProgram);
                
                vertexPositionAttrib = gl.getAttribLocation(shaderProgram, "vertexPosition");
                gl.enableVertexAttribArray(vertexPositionAttrib);

                vertexNormalAttrib = gl.getAttribLocation(shaderProgram, "vertexNormal");
                gl.enableVertexAttribArray(vertexNormalAttrib);

                vertexAmbientAttrib = gl.getAttribLocation(shaderProgram, "vertexAmbient");
                gl.enableVertexAttribArray(vertexAmbientAttrib);

                vertexDiffuseAttrib = gl.getAttribLocation(shaderProgram, "vertexDiffuse");
                gl.enableVertexAttribArray(vertexDiffuseAttrib);

                vertexSpecularAttrib = gl.getAttribLocation(shaderProgram, "vertexSpecular");
                gl.enableVertexAttribArray(vertexSpecularAttrib);

                vertexShininessAttrib = gl.getAttribLocation(shaderProgram, "vertexShininess");
                gl.enableVertexAttribArray(vertexShininessAttrib);

                mvMatrixUniform = gl.getUniformLocation(shaderProgram, "uMVMatrix");
                pMatrixUniform = gl.getUniformLocation(shaderProgram, "uPMatrix");
                nMatrixUniform = gl.getUniformLocation(shaderProgram, "uNMatrix");
            }
        }
    } 
    catch(e) {
        console.log(e);
    }

    var fov = Math.PI / 2; 
    var aspect = gl.canvas.width / gl.canvas.height;
    mat4.perspective(pMatrix, fov, aspect, 0.1, 100.0);

    var eye = vec3.fromValues(0.5, 0.5, -0.5);
    var center = vec3.fromValues(0.5, 0.5, 1.0);
    var up = vec3.fromValues(0, 1, 0);
    mat4.lookAt(mvMatrix, eye, center, up);
} 

function renderTriangles() {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); 

    // Compute normal matrix (transpose inverse of model-view matrix)
    mat3.normalFromMat4(nMatrix, mvMatrix);

    gl.uniformMatrix4fv(pMatrixUniform, false, pMatrix);
    gl.uniformMatrix4fv(mvMatrixUniform, false, mvMatrix);
    gl.uniformMatrix3fv(nMatrixUniform, false, nMatrix);

    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer); 
    gl.vertexAttribPointer(vertexPositionAttrib, 3, gl.FLOAT, false, 0, 0); 

    gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
    gl.vertexAttribPointer(vertexNormalAttrib, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, ambientBuffer);
    gl.vertexAttribPointer(vertexAmbientAttrib, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
    gl.vertexAttribPointer(vertexDiffuseAttrib, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, specularBuffer);
    gl.vertexAttribPointer(vertexSpecularAttrib, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, shininessBuffer);
    gl.vertexAttribPointer(vertexShininessAttrib, 1, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triangleBuffer);
    gl.drawElements(gl.TRIANGLES, triBufferSize, gl.UNSIGNED_SHORT, 0); 

    requestAnimationFrame(renderTriangles);
} 

function main() {
  setupWebGL(); 
  loadTriangles(); 
  setupShaders(); 
  renderTriangles(); 
}
