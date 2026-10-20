/* GLOBAL CONSTANTS AND VARIABLES */

const WIN_Z = 0;  
const WIN_LEFT = 0; const WIN_RIGHT = 1;  
const WIN_BOTTOM = 0; const WIN_TOP = 1;  

const INPUT_TRIANGLES_URL = "https://ncsucgclass.github.io/prog3/triangles2.json"; 
const INPUT_ELLIPSOIDS_URL = "https://ncsucgclass.github.io/prog3/ellipsoids.json";

/* webgl globals */
var gl = null; 

var vertexPositionAttrib; 
var vertexNormalAttrib;
var vertexAmbientAttrib;
var vertexDiffuseAttrib;
var vertexSpecularAttrib;
var vertexShininessAttrib;

// Matrix Uniforms and Objects
var mvMatrixUniform, pMatrixUniform, nMatrixUniform, lightingEnabledUniform;
var mvMatrix = mat4.create();
var pMatrix = mat4.create();
var nMatrix = mat3.create();

// Triangle Sets array and selection state for Parts 5 & 6
var triangleSets = [];
var selectedIndex = -1;

// Camera Parameters for Part 4
var eye = vec3.fromValues(0.5, 0.5, -0.5);
var center = vec3.fromValues(0.5, 0.5, 1.0);
var up = vec3.fromValues(0, 1, 0);

/* ASSIGNMENT HELPER FUNCTIONS */

function getJSONFile(url, descr) {
    try {
        if ((typeof(url) !== "string") || (typeof(descr) !== "string"))
            throw "getJSONFile: parameter not a string";
        else {
            var httpReq = new XMLHttpRequest(); 
            httpReq.open("GET", url, false); 
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
    var inputTriangles = getJSONFile(INPUT_TRIANGLES_URL, "triangles");
    if (inputTriangles != null) { 
        for (var whichSet=0; whichSet<inputTriangles.length; whichSet++) {
            var triangleSet = inputTriangles[whichSet];
            var mat = triangleSet.material;
            
            var coordArray = []; 
            var normalArray = []; 
            var ambientArray = [];
            var diffuseArray = []; 
            var specularArray = [];
            var shininessArray = [];
            var indexArray = []; 
            
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
                indexArray.push(tri[0], tri[1], tri[2]);
            } 

            var vBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(coordArray), gl.STATIC_DRAW);
            
            var nBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, nBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normalArray), gl.STATIC_DRAW);

            var aBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, aBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(ambientArray), gl.STATIC_DRAW);

            var cBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, cBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(diffuseArray), gl.STATIC_DRAW);

            var sBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, sBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(specularArray), gl.STATIC_DRAW);

            var shineBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, shineBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(shininessArray), gl.STATIC_DRAW);

            var tBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, tBuffer);
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indexArray), gl.STATIC_DRAW);

            // Store each triangle set with buffers, translation, rotation, and highlight status
            triangleSets.push({
                vertexBuffer: vBuffer,
                normalBuffer: nBuffer,
                ambientBuffer: aBuffer,
                colorBuffer: cBuffer,
                specularBuffer: sBuffer,
                shininessBuffer: shineBuffer,
                triangleBuffer: tBuffer,
                triBufferSize: indexArray.length,
                translation: vec3.create(), 
                rotation: vec3.create(),    
                isHighlighted: false
            });
        } 
        
        console.log("Loaded " + triangleSets.length + " triangle sets.");
    } 
} 

// setup the webGL shaders with toggleable Blinn-Phong lighting
function setupShaders() {
    var fShaderCode = `
        precision mediump float;
        
        varying vec3 vPosition;
        varying vec3 vNormal;
        varying vec3 vAmbient;
        varying vec3 vDiffuse;
        varying vec3 vSpecular;
        varying float vShininess;

        uniform bool uLightingEnabled;

        void main(void) {
            if (!uLightingEnabled) {
                // Part 2: Unlit flat diffuse color
                gl_FragColor = vec4(vDiffuse, 1.0);
            } else {
                // Part 3: Blinn-Phong lighting model
                vec3 lightPosition = vec3(-0.5, 1.5, -0.5);
                vec3 lightColor = vec3(1.1, 1.1, 1.1);

                vec3 N = normalize(vNormal);
                vec3 L = normalize(lightPosition - vPosition);
                vec3 V = normalize(-vPosition); 
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
                lightingEnabledUniform = gl.getUniformLocation(shaderProgram, "uLightingEnabled");
            }
        }
    } 
    catch(e) {
        console.log(e);
    }

    var fov = Math.PI / 2; 
    var aspect = gl.canvas.width / gl.canvas.height;
    mat4.perspective(pMatrix, fov, aspect, 0.1, 100.0);
} 

// Keyboard Event Handlers for Parts 4, 5, and 6
function setupEvents() {
    window.addEventListener("keydown", function(event) {
        var key = event.key;
        var translateStep = 0.05;
        var rotateStep = 0.03;

        // Compute viewing coordinate axes
        var viewZ = vec3.create(); // Forward
        vec3.subtract(viewZ, center, eye);
        vec3.normalize(viewZ, viewZ);

        var viewX = vec3.create(); // Side (X)
        vec3.cross(viewX, viewZ, up);
        vec3.normalize(viewX, viewX);

        var viewY = vec3.create(); // Up (Y)
        vec3.cross(viewY, viewX, viewZ);
        vec3.normalize(viewY, viewY);

        // --- CAMERA TRANSLATIONS (a, d, w, s, q, e) ---
        if (key === 'd') {
            vec3.scaleAndAdd(eye, eye, viewX, -translateStep);
            vec3.scaleAndAdd(center, center, viewX, -translateStep);
        } else if (key === 'a') {
            vec3.scaleAndAdd(eye, eye, viewX, translateStep);
            vec3.scaleAndAdd(center, center, viewX, translateStep);
        } else if (key === 'w') {
            vec3.scaleAndAdd(eye, eye, viewZ, translateStep);
            vec3.scaleAndAdd(center, center, viewZ, translateStep);
        } else if (key === 's') {
            vec3.scaleAndAdd(eye, eye, viewZ, -translateStep);
            vec3.scaleAndAdd(center, center, viewZ, -translateStep);
        } else if (key === 'e') {
            vec3.scaleAndAdd(eye, eye, viewY, translateStep);
            vec3.scaleAndAdd(center, center, viewY, translateStep);
        } else if (key === 'q') {
            vec3.scaleAndAdd(eye, eye, viewY, -translateStep);
            vec3.scaleAndAdd(center, center, viewY, -translateStep);
        }

        // --- CAMERA ROTATIONS (A, D, W, S) ---
        else if (key === 'A') {
            let rotMat = mat4.create();
            mat4.rotate(rotMat, rotMat, -rotateStep, viewY);
            vec3.transformMat4(viewZ, viewZ, rotMat);
            vec3.add(center, eye, viewZ);
        } else if (key === 'D') {
            let rotMat = mat4.create();
            mat4.rotate(rotMat, rotMat, rotateStep, viewY);
            vec3.transformMat4(viewZ, viewZ, rotMat);
            vec3.add(center, eye, viewZ);
        } else if (key === 'S') {
            let rotMat = mat4.create();
            mat4.rotate(rotMat, rotMat, rotateStep, viewX);
            vec3.transformMat4(viewZ, viewZ, rotMat);
            vec3.add(center, eye, viewZ);
        } else if (key === 'W') {
            let rotMat = mat4.create();
            mat4.rotate(rotMat, rotMat, -rotateStep, viewX);
            vec3.transformMat4(viewZ, viewZ, rotMat);
            vec3.add(center, eye, viewZ);
        }

        // --- PART 5: MODEL SELECTION ---
        else if (key === 'ArrowRight' || event.keyCode === 39) {
            event.preventDefault();
            if (triangleSets.length > 0) {
                if (selectedIndex !== -1) {
                    triangleSets[selectedIndex].isHighlighted = false;
                }
                selectedIndex = (selectedIndex + 1) % triangleSets.length;
                triangleSets[selectedIndex].isHighlighted = true;
            }
        } else if (key === 'ArrowLeft' || event.keyCode === 37) {
            event.preventDefault();
            if (triangleSets.length > 0) {
                if (selectedIndex !== -1) {
                    triangleSets[selectedIndex].isHighlighted = false;
                }
                selectedIndex = (selectedIndex - 1 + triangleSets.length) % triangleSets.length;
                triangleSets[selectedIndex].isHighlighted = true;
            }
        } else if (key === ' ' || event.code === 'Space' || event.keyCode === 32) {
            event.preventDefault();
            if (selectedIndex !== -1) {
                triangleSets[selectedIndex].isHighlighted = false;
                selectedIndex = -1;
            }
        }

        // --- PART 6: INTERACTIVE MODEL TRANSFORMATIONS ---
        else if (selectedIndex !== -1) {
            var curSet = triangleSets[selectedIndex];
            var modelTranslateStep = 0.05;
            var modelRotateStep = 0.05;

            if (key === 'k') { // Translate selection left along view X
                vec3.scaleAndAdd(curSet.translation, curSet.translation, viewX, -modelTranslateStep);
            } else if (key === ';') { // Translate selection right along view X
                vec3.scaleAndAdd(curSet.translation, curSet.translation, viewX, modelTranslateStep);
            } else if (key === 'o') { // Translate selection forward along view Z
                vec3.scaleAndAdd(curSet.translation, curSet.translation, viewZ, modelTranslateStep);
            } else if (key === 'l') { // Translate selection backward along view Z
                vec3.scaleAndAdd(curSet.translation, curSet.translation, viewZ, -modelTranslateStep);
            } else if (key === 'L') { // Rotate selection backward (pitch) around view X
                curSet.rotation[0] -= modelRotateStep;
            } else if (key === 'i') { // Translate selection up along view Y
                vec3.scaleAndAdd(curSet.translation, curSet.translation, viewY, modelTranslateStep);
            } else if (key === 'p') { // Translate selection down along view Y
                vec3.scaleAndAdd(curSet.translation, curSet.translation, viewY, -modelTranslateStep);
            } 
            
            // Rotations
            else if (key === 'K') { // Rotate selection left (yaw) around view Y
                curSet.rotation[1] += modelRotateStep;
            } else if (key === ':') { // Rotate selection right (yaw) around view Y
                curSet.rotation[1] -= modelRotateStep;
            } else if (key === 'O') { // Rotate selection forward (pitch) around view X
                curSet.rotation[0] += modelRotateStep;
            } else if (key === 'I') { // Rotate selection clockwise (roll) around view Z
                curSet.rotation[2] += modelRotateStep;
            } else if (key === 'P') { // Rotate selection counterclockwise (roll) around view Z
                curSet.rotation[2] -= modelRotateStep;
            }
        }
    });
}

function renderTriangles() {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); 

    // Check state of HTML lighting checkbox
    var lightingEnabled = document.getElementById("lightingCheck").checked;

    // Compute base View Matrix
    var vMatrix = mat4.create();
    mat4.lookAt(vMatrix, eye, center, up);

    // Render each triangle set using its updated model matrix
    for (var i = 0; i < triangleSets.length; i++) {
        var tSet = triangleSets[i];

        // Construct model matrix (mMatrix): 
        // Order: Translation first, then Rotation (so it rotates around itself), then Scale highlight.
        var mMatrix = mat4.create();
        
        // 1. Apply translation offset
        mat4.translate(mMatrix, mMatrix, tSet.translation);
        
        // 2. Apply rotations around local/view axes (Pitch, Yaw, Roll)
        mat4.rotateX(mMatrix, mMatrix, tSet.rotation[0]);
        mat4.rotateY(mMatrix, mMatrix, tSet.rotation[1]);
        mat4.rotateZ(mMatrix, mMatrix, tSet.rotation[2]);

        // 3. Apply 20% highlight scaling if selected
        if (tSet.isHighlighted) {
            mat4.scale(mMatrix, mMatrix, vec3.fromValues(1.2, 1.2, 1.2));
        }

        // Model-View Matrix = View Matrix * Model Matrix
        mat4.multiply(mvMatrix, vMatrix, mMatrix);
        mat3.normalFromMat4(nMatrix, mvMatrix);

        gl.uniformMatrix4fv(pMatrixUniform, false, pMatrix);
        gl.uniformMatrix4fv(mvMatrixUniform, false, mvMatrix);
        gl.uniformMatrix3fv(nMatrixUniform, false, nMatrix);
        gl.uniform1i(lightingEnabledUniform, lightingEnabled ? 1 : 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, tSet.vertexBuffer); 
        gl.vertexAttribPointer(vertexPositionAttrib, 3, gl.FLOAT, false, 0, 0); 

        gl.bindBuffer(gl.ARRAY_BUFFER, tSet.normalBuffer);
        gl.vertexAttribPointer(vertexNormalAttrib, 3, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, tSet.ambientBuffer);
        gl.vertexAttribPointer(vertexAmbientAttrib, 3, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, tSet.colorBuffer);
        gl.vertexAttribPointer(vertexDiffuseAttrib, 3, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, tSet.specularBuffer);
        gl.vertexAttribPointer(vertexSpecularAttrib, 3, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, tSet.shininessBuffer);
        gl.vertexAttribPointer(vertexShininessAttrib, 1, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, tSet.triangleBuffer);
        gl.drawElements(gl.TRIANGLES, tSet.triBufferSize, gl.UNSIGNED_SHORT, 0); 
    }

    requestAnimationFrame(renderTriangles);
} 

function main() {
  setupWebGL(); 
  loadTriangles(); 
  setupShaders(); 
  setupEvents(); 
  renderTriangles(); 
}
