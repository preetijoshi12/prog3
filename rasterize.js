/* GLOBAL CONSTANTS AND VARIABLES */

var WIN_Z = 0;  
var WIN_LEFT = 0; var WIN_RIGHT = 1;  
var WIN_BOTTOM = 0; var WIN_TOP = 1;  

const INPUT_TRIANGLES_URL = "https://ncsucgclass.github.io/prog3/triangles2.json"; 
const INPUT_ELLIPSOIDS_URL = "https://ncsucgclass.github.io/prog3/ellipsoids.json";
const INPUT_LIGHTS_URL = "https://ncsucgclass.github.io/prog3/lights.json"; // Part 7: Lights JSON URL

/* webgl globals */
var gl = null; 
var lights = []; // Part 7: Array to hold loaded lights

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

// Lighting Uniforms (Part 7: supports multiple lights)
var numLightsUniform;
var lightPositionUniforms = [];
var lightAmbientUniforms = [];
var lightDiffuseUniforms = [];
var lightSpecularUniforms = [];
const MAX_LIGHTS = 10;

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
         // Part 7: Ensure initial viewport matches canvas dimensions
         gl.viewport(0, 0, canvas.width, canvas.height);
        gl.clearColor(0.0, 0.0, 0.0, 1.0); 
        gl.clearDepth(1.0); 
        gl.enable(gl.DEPTH_TEST); 
      }
    } 
    catch(e) {
      console.log(e);
    } 
} 

// Part 7: Load lights from lights.json
function loadLights() {
    var inputLights = getJSONFile(INPUT_LIGHTS_URL, "lights");
    if (inputLights != null) {
        lights = inputLights;
        console.log("Loaded " + lights.length + " lights.");
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

            triangleSets.push({
                vertexBuffer: vBuffer,
                normalBuffer: nBuffer,
                ambientBuffer: aBuffer,
                colorBuffer: cBuffer,
                specularBuffer: sBuffer,
                shininessBuffer: shineBuffer,
                triangleBuffer: tBuffer,
                triBufferSize: indexArray.length,
                mMatrix: mat4.create(),
                translation: vec3.create(),
                rotation: mat4.create()
            });
        } 
        console.log("Loaded " + triangleSets.length + " triangle sets.");
    } 
} 

// setup the webGL shaders with toggleable multi-light Blinn-Phong lighting (Part 7)
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

        // Part 7: Multiple lights uniforms
        #define MAX_LIGHTS 10
        uniform int uNumLights;
        uniform vec3 uLightPosition[MAX_LIGHTS];
        uniform vec3 uLightAmbient[MAX_LIGHTS];
        uniform vec3 uLightDiffuse[MAX_LIGHTS];
        uniform vec3 uLightSpecular[MAX_LIGHTS];

        void main(void) {
            if (!uLightingEnabled) {
                gl_FragColor = vec4(vDiffuse, 1.0);
            } else {
                vec3 N = normalize(vNormal);
                vec3 V = normalize(-vPosition); 

                vec3 finalColor = vec3(0.0, 0.0, 0.0);

                for (int i = 0; i < MAX_LIGHTS; i++) {
                    if (i >= uNumLights) break;

                    vec3 L = normalize(uLightPosition[i] - vPosition);
                    vec3 H = normalize(L + V);

                    // Ambient
                    vec3 ambient = vAmbient * uLightAmbient[i];

                    // Diffuse
                    float diff = max(dot(N, L), 0.0);
                    vec3 diffuse = diff * (vDiffuse * uLightDiffuse[i]);

                    // Specular (Blinn-Phong)
                    float spec = 0.0;
                    if (diff > 0.0) {
                        spec = pow(max(dot(N, H), 0.0), vShininess);
                    }
                    vec3 specular = spec * (vSpecular * uLightSpecular[i]);

                    finalColor += (ambient + diffuse + specular);
                }

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

                // Part 7: Get uniform locations for multiple lights
                numLightsUniform = gl.getUniformLocation(shaderProgram, "uNumLights");
                for (var i = 0; i < MAX_LIGHTS; i++) {
                    lightPositionUniforms.push(gl.getUniformLocation(shaderProgram, "uLightPosition[" + i + "]"));
                    lightAmbientUniforms.push(gl.getUniformLocation(shaderProgram, "uLightAmbient[" + i + "]"));
                    lightDiffuseUniforms.push(gl.getUniformLocation(shaderProgram, "uLightDiffuse[" + i + "]"));
                    lightSpecularUniforms.push(gl.getUniformLocation(shaderProgram, "uLightSpecular[" + i + "]"));
                }
            }
        }
    } 
    catch(e) {
        console.log(e);
    }

    // Part 7: Flexible projection using mat4.frustum scaled by the near plane
    updateProjectionMatrix();
} 

// Part 7: Helper function to update projection matrix and viewport dynamically
function updateProjectionMatrix() {
    var near = 0.1;
    var far = 100.0;
    // Scale window coordinates by near distance to properly map frustum bounds
    mat4.frustum(
        pMatrix, 
        WIN_LEFT * near, 
        WIN_RIGHT * near, 
        WIN_BOTTOM * near, 
        WIN_TOP * near, 
        near, 
        far
    );
}

function setupEvents() {
    window.addEventListener("keydown", function(event) {
        var key = event.key;
        var translateStep = 0.05;
        var rotateStep = 0.03;

        var viewZ = vec3.create(); 
        vec3.subtract(viewZ, center, eye);
        vec3.normalize(viewZ, viewZ);

        var viewX = vec3.create(); 
        vec3.cross(viewX, viewZ, up);
        vec3.normalize(viewX, viewX);

        var viewY = vec3.create(); 
        vec3.cross(viewY, viewX, viewZ);
        vec3.normalize(viewY, viewY);

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
        } else if (key === 'W') { 
            let rotMat = mat4.create();
            mat4.rotate(rotMat, rotMat, rotateStep, viewX);
            vec3.transformMat4(viewZ, viewZ, rotMat);
            vec3.add(center, eye, viewZ);
        } else if (key === 'S') { 
            let rotMat = mat4.create();
            mat4.rotate(rotMat, rotMat, -rotateStep, viewX);
            vec3.transformMat4(viewZ, viewZ, rotMat);
            vec3.add(center, eye, viewZ);
        }

        else if (key === 'ArrowRight' || event.keyCode === 39) {
            event.preventDefault();
            if (triangleSets.length > 0) {
                selectedIndex = (selectedIndex + 1) % triangleSets.length;
            }
        } else if (key === 'ArrowLeft' || event.keyCode === 37) {
            event.preventDefault();
            if (triangleSets.length > 0) {
                selectedIndex = (selectedIndex - 1 + triangleSets.length) % triangleSets.length;
            }
        } else if (key === ' ' || event.code === 'Space' || event.keyCode === 32) {
            event.preventDefault();
            selectedIndex = -1;
        }

        if (selectedIndex !== -1) {
            var tSet = triangleSets[selectedIndex];

            if (key === 'k') { 
                vec3.scaleAndAdd(tSet.translation, tSet.translation, viewX, -translateStep);
                event.preventDefault();
            } else if (key === ';' || key === ',') { 
                vec3.scaleAndAdd(tSet.translation, tSet.translation, viewX, translateStep);
                event.preventDefault();
            } else if (key === 'l') { 
                vec3.scaleAndAdd(tSet.translation, tSet.translation, viewZ, translateStep);
                event.preventDefault();
            } else if (key === 'o') { 
                vec3.scaleAndAdd(tSet.translation, tSet.translation, viewZ, -translateStep);
                event.preventDefault();
            } else if (key === 'i') { 
                vec3.scaleAndAdd(tSet.translation, tSet.translation, viewY, translateStep);
                event.preventDefault();
            } else if (key === 'p') { 
                vec3.scaleAndAdd(tSet.translation, tSet.translation, viewY, -translateStep);
                event.preventDefault();
            } else if (key === 'K') { 
                let rotMat = mat4.create();
                mat4.rotate(rotMat, rotMat, rotateStep, viewY);
                mat4.multiply(tSet.rotation, rotMat, tSet.rotation);
                event.preventDefault();
            } else if (key === ':' || (key === 'K' && event.shiftKey)) { 
                let rotMat = mat4.create();
                mat4.rotate(rotMat, rotMat, -rotateStep, viewY);
                mat4.multiply(tSet.rotation, rotMat, tSet.rotation);
                event.preventDefault();
            } else if (key === 'O') { 
                let rotMat = mat4.create();
                mat4.rotate(rotMat, rotMat, rotateStep, viewX);
                mat4.multiply(tSet.rotation, rotMat, tSet.rotation);
                event.preventDefault();
            } else if (key === 'L') { 
                let rotMat = mat4.create();
                mat4.rotate(rotMat, rotMat, -rotateStep, viewX);
                mat4.multiply(tSet.rotation, rotMat, tSet.rotation);
                event.preventDefault();
            } else if (key === 'I') { 
                let rotMat = mat4.create();
                mat4.rotate(rotMat, rotMat, rotateStep, viewZ);
                mat4.multiply(tSet.rotation, rotMat, tSet.rotation);
                event.preventDefault();
            } else if (key === 'P') { 
                let rotMat = mat4.create();
                mat4.rotate(rotMat, rotMat, -rotateStep, viewZ);
                mat4.multiply(tSet.rotation, rotMat, tSet.rotation);
                event.preventDefault();
            }
        }
    });
}

function renderTriangles() {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); 

    var lightingEnabled = document.getElementById("lightingCheck").checked;

    var vMatrix = mat4.create();
    mat4.lookAt(vMatrix, eye, center, up);

    // Part 7: Send light data to shader (transforming world light positions into eye space)
    gl.uniform1i(numLightsUniform, Math.min(lights.length, MAX_LIGHTS));
    for (var i = 0; i < lights.length && i < MAX_LIGHTS; i++) {
        var light = lights[i];
        var lightPosWorld = vec4.fromValues(light.x, light.y, light.z, 1.0);
        var lightPosEye = vec4.create();
        vec4.transformMat4(lightPosEye, lightPosWorld, vMatrix);

        gl.uniform3f(lightPositionUniforms[i], lightPosEye[0] / lightPosEye[3], lightPosEye[1] / lightPosEye[3], lightPosEye[2] / lightPosEye[3]);
        gl.uniform3f(lightAmbientUniforms[i], light.ambient[0], light.ambient[1], light.ambient[2]);
        gl.uniform3f(lightDiffuseUniforms[i], light.diffuse[0], light.diffuse[1], light.diffuse[2]);
        gl.uniform3f(lightSpecularUniforms[i], light.specular[0], light.specular[1], light.specular[2]);
    }

    for (var i = 0; i < triangleSets.length; i++) {
        var tSet = triangleSets[i];

        mat4.identity(tSet.mMatrix);
        mat4.translate(tSet.mMatrix, tSet.mMatrix, tSet.translation);
        mat4.multiply(tSet.mMatrix, tSet.mMatrix, tSet.rotation);
        if (i === selectedIndex) {
            mat4.scale(tSet.mMatrix, tSet.mMatrix, vec3.fromValues(1.2, 1.2, 1.2));
        }

        mat4.multiply(mvMatrix, vMatrix, tSet.mMatrix);
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
    loadLights(); // Part 7: Load lights from JSON
    setupShaders(); 
    setupEvents(); 
    renderTriangles(); 
}
