/* GLOBAL CONSTANTS AND VARIABLES */

const INPUT_TRIANGLES_URL = "https://ncsucgclass.github.io/prog3/triangles2.json"; 
const INPUT_ELLIPSOIDS_URL = "https://ncsucgclass.github.io/prog3/ellipsoids.json";
const INPUT_LIGHTS_URL = "https://ncsucgclass.github.io/prog3/lights.json";

/* webgl globals */
var gl = null; 

var vertexPositionAttrib; 
var vertexNormalAttrib;
var vertexAmbientAttrib;
var vertexDiffuseAttrib;
var vertexSpecularAttrib;
var vertexShininessAttrib;

// Matrix Uniforms and Objects
var mvMatrixUniform, pMatrixUniform, nMatrixUniform, vMatrixUniform, lightingEnabledUniform;
var numLightsUniform;

var mvMatrix = mat4.create();
var pMatrix = mat4.create();
var nMatrix = mat3.create();
var vMatrix = mat4.create();

// Array of Light Uniform Locations
var lightUniforms = [];
var MAX_LIGHTS = 10;
var inputLights = [];

// Window Frustum Projection Parameters
var winLeft = -0.1, winRight = 0.1;
var winBottom = -0.1, winTop = 0.1;
var nearDist = 0.1, farDist = 100.0;

// Triangle Sets array and selection state for Parts 1-9
var triangleSets = [];
var customSceneSets = []; // Part 10 Procedural Triangle Mesh Sets
var selectedIndex = -1;

// Camera Parameters for Part 4
var eye = vec3.fromValues(0.5, 0.5, -0.5);
var center = vec3.fromValues(0.5, 0.5, 1.0);
var up = vec3.fromValues(0, 1, 0);

// Default Camera Backup for Reset
var defaultEye = vec3.clone(eye);
var defaultCenter = vec3.clone(center);

// --- PART 10: CUSTOM GEOMETRY & SKETCH ANIMATION GLOBALS ---
var isFootballMode = false;
var isKickAnimating = false; // Triggered by 'g' key
var rollDistance = 0.0;     // Ball roll progress toward goal
var rollAngle = 0.0;        // Ball rotation angle for rolling

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

function loadLights() {
    inputLights = getJSONFile(INPUT_LIGHTS_URL, "lights");
    if (inputLights == null) {
        inputLights = [];
    }
    console.log("Loaded " + inputLights.length + " light sources.");
}

function computeVertexNormals(vertices, triangles) {
    var normals = new Array(vertices.length);
    for (var i = 0; i < vertices.length; i++) {
        normals[i] = vec3.fromValues(0, 0, 0);
    }

    for (var t = 0; t < triangles.length; t++) {
        var tri = triangles[t];
        var p0 = vec3.fromValues(vertices[tri[0]][0], vertices[tri[0]][1], vertices[tri[0]][2]);
        var p1 = vec3.fromValues(vertices[tri[1]][0], vertices[tri[1]][1], vertices[tri[1]][2]);
        var p2 = vec3.fromValues(vertices[tri[2]][0], vertices[tri[2]][1], vertices[tri[2]][2]);

        var v10 = vec3.create();
        var v20 = vec3.create();
        vec3.subtract(v10, p1, p0);
        vec3.subtract(v20, p2, p0);

        var faceNormal = vec3.create();
        vec3.cross(faceNormal, v10, v20);

        vec3.add(normals[tri[0]], normals[tri[0]], faceNormal);
        vec3.add(normals[tri[1]], normals[tri[1]], faceNormal);
        vec3.add(normals[tri[2]], normals[tri[2]], faceNormal);
    }

    for (var v = 0; v < vertices.length; v++) {
        vec3.normalize(normals[v], normals[v]);
    }

    return normals;
}

// Build WebGL buffer objects for triangle meshes
function createMeshObject(coords, normals, amb, diff, spec, shine, indices) {
    var vBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(coords), gl.STATIC_DRAW);

    var nBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, nBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW);

    var aBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, aBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(amb), gl.STATIC_DRAW);

    var cBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, cBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(diff), gl.STATIC_DRAW);

    var sBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, sBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(spec), gl.STATIC_DRAW);

    var shineBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, shineBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(shine), gl.STATIC_DRAW);

    var tBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, tBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);

    return {
        vertexBuffer: vBuffer,
        normalBuffer: nBuffer,
        ambientBuffer: aBuffer,
        colorBuffer: cBuffer,
        specularBuffer: sBuffer,
        shininessBuffer: shineBuffer,
        triangleBuffer: tBuffer,
        triBufferSize: indices.length,
        center: vec3.fromValues(0, 0, 0),
        translation: vec3.create(),
        rotationMatrix: mat4.create(),
        isHighlighted: false
    };
}

// Build 3D Box Mesh using triangles
function createBoxMesh(colorRGB) {
    var coords = [
        -0.5,-0.5, 0.5,  0.5,-0.5, 0.5,  0.5, 0.5, 0.5, -0.5, 0.5, 0.5,
        -0.5,-0.5,-0.5, -0.5, 0.5,-0.5,  0.5, 0.5,-0.5,  0.5,-0.5,-0.5,
        -0.5, 0.5,-0.5, -0.5, 0.5, 0.5,  0.5, 0.5, 0.5,  0.5, 0.5,-0.5,
        -0.5,-0.5,-0.5,  0.5,-0.5,-0.5,  0.5,-0.5, 0.5, -0.5,-0.5, 0.5,
         0.5,-0.5,-0.5,  0.5, 0.5,-0.5,  0.5, 0.5, 0.5,  0.5,-0.5, 0.5,
        -0.5,-0.5,-0.5, -0.5,-0.5, 0.5, -0.5, 0.5, 0.5, -0.5, 0.5,-0.5
    ];
    var normals = [
         0.0, 0.0, 1.0,  0.0, 0.0, 1.0,  0.0, 0.0, 1.0,  0.0, 0.0, 1.0,
         0.0, 0.0,-1.0,  0.0, 0.0,-1.0,  0.0, 0.0,-1.0,  0.0, 0.0,-1.0,
         0.0, 1.0, 0.0,  0.0, 1.0, 0.0,  0.0, 1.0, 0.0,  0.0, 1.0, 0.0,
         0.0,-1.0, 0.0,  0.0,-1.0, 0.0,  0.0,-1.0, 0.0,  0.0,-1.0, 0.0,
         1.0, 0.0, 0.0,  1.0, 0.0, 0.0,  1.0, 0.0, 0.0,  1.0, 0.0, 0.0,
        -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0, -1.0, 0.0, 0.0
    ];
    var amb = [], diff = [], spec = [], shine = [];
    for (var i = 0; i < 24; i++) {
        amb.push(colorRGB[0]*0.2, colorRGB[1]*0.2, colorRGB[2]*0.2);
        diff.push(colorRGB[0], colorRGB[1], colorRGB[2]);
        spec.push(1.0, 1.0, 1.0);
        shine.push(15.0);
    }
    var indices = [
        0, 1, 2, 0, 2, 3,    4, 5, 6, 4, 6, 7,
        8, 9, 10, 8, 10, 11,  12, 13, 14, 12, 14, 15,
        16, 17, 18, 16, 18, 19, 20, 21, 22, 20, 22, 23
    ];
    return createMeshObject(coords, normals, amb, diff, spec, shine, indices);
}

// Build 3D Sphere Mesh using triangles
function createSphereMesh(colorRGB, radius, latBands, longBands) {
    var coords = [], normals = [], amb = [], diff = [], spec = [], shine = [], indices = [];

    for (var lat = 0; lat <= latBands; lat++) {
        var theta = lat * Math.PI / latBands;
        var sinTheta = Math.sin(theta);
        var cosTheta = Math.cos(theta);

        for (var long = 0; long <= longBands; long++) {
            var phi = long * 2 * Math.PI / longBands;
            var x = Math.cos(phi) * sinTheta;
            var y = cosTheta;
            var z = Math.sin(phi) * sinTheta;

            coords.push(radius * x, radius * y, radius * z);
            normals.push(x, y, z);
            amb.push(colorRGB[0]*0.2, colorRGB[1]*0.2, colorRGB[2]*0.2);
            diff.push(colorRGB[0], colorRGB[1], colorRGB[2]);
            spec.push(1.0, 1.0, 1.0);
            shine.push(20.0);
        }
    }

    for (var lat = 0; lat < latBands; lat++) {
        for (var long = 0; long < longBands; long++) {
            var first = (lat * (longBands + 1)) + long;
            var second = first + longBands + 1;
            indices.push(first, second, first + 1);
            indices.push(second, second + 1, first + 1);
        }
    }

    return createMeshObject(coords, normals, amb, diff, spec, shine, indices);
}

// Build Part 10 Custom Scene Objects
function buildPart10CustomScene() {
    customSceneSets = [];
    // 0: Ball (Sphere)
    customSceneSets.push(createSphereMesh([0.9, 0.9, 0.9], 0.08, 16, 16));
    // 1: Kicker Head
    customSceneSets.push(createSphereMesh([0.8, 0.6, 0.4], 0.07, 12, 12));
    // 2: Torso (Red Shirt)
    customSceneSets.push(createBoxMesh([0.6, 0.15, 0.15]));
    // 3: Left Arm (Raised)
    customSceneSets.push(createBoxMesh([0.6, 0.15, 0.15]));
    // 4: Right Arm (Raised)
    customSceneSets.push(createBoxMesh([0.6, 0.15, 0.15]));
    // 5: Left Leg (Blue Pants)
    customSceneSets.push(createBoxMesh([0.1, 0.1, 0.6]));
    // 6: Right Kicking Leg (Blue Pants)
    customSceneSets.push(createBoxMesh([0.1, 0.1, 0.6]));
    // 7: Goalpost Left Post
    customSceneSets.push(createBoxMesh([0.95, 0.95, 0.95]));
    // 8: Goalpost Right Post
    customSceneSets.push(createBoxMesh([0.95, 0.95, 0.95]));
    // 9: Goalpost Top Bar
    customSceneSets.push(createBoxMesh([0.95, 0.95, 0.95]));
    // 10: Pitch Turf Ground
    customSceneSets.push(createBoxMesh([0.05, 0.4, 0.05]));
}

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
            
            var vNormals = triangleSet.normals;
            if (!vNormals || vNormals.length !== triangleSet.vertices.length) {
                vNormals = computeVertexNormals(triangleSet.vertices, triangleSet.triangles);
            }

            var centerPt = vec3.fromValues(0, 0, 0);
            for (var v = 0; v < triangleSet.vertices.length; v++) {
                vec3.add(centerPt, centerPt, triangleSet.vertices[v]);
            }
            if (triangleSet.vertices.length > 0) {
                vec3.scale(centerPt, centerPt, 1.0 / triangleSet.vertices.length);
            }

            for (var whichSetVert=0; whichSetVert<triangleSet.vertices.length; whichSetVert++){
                coordArray.push(triangleSet.vertices[whichSetVert][0], triangleSet.vertices[whichSetVert][1], triangleSet.vertices[whichSetVert][2]);
                
                var norm = vNormals[whichSetVert];
                normalArray.push(norm[0], norm[1], norm[2]);
                
                ambientArray.push(mat.ambient[0], mat.ambient[1], mat.ambient[2]);
                diffuseArray.push(mat.diffuse[0], mat.diffuse[1], mat.diffuse[2]);
                specularArray.push(mat.specular[0], mat.specular[1], mat.specular[2]);
                shininessArray.push(mat.n);
            }

            for (var whichSetTri=0; whichSetTri<triangleSet.triangles.length; whichSetTri++) {
                var tri = triangleSet.triangles[whichSetTri];
                indexArray.push(tri[0], tri[1], tri[2]);
            } 

            triangleSets.push(createMeshObject(coordArray, normalArray, ambientArray, diffuseArray, specularArray, shininessArray, indexArray));
        } 
        console.log("Loaded " + triangleSets.length + " default triangle sets.");
    } 

    buildPart10CustomScene();
} 

function setupShaders() {
    var fShaderCode = `
        precision mediump float;
        
        varying vec3 vPosition;
        varying vec3 vNormal;
        varying vec3 vAmbient;
        varying vec3 vDiffuse;
        varying vec3 vSpecular;
        varying float vShininess;

        struct Light {
            vec3 position;
            vec3 ambient;
            vec3 diffuse;
            vec3 specular;
        };

        const int MAX_LIGHTS = 10;
        uniform Light uLights[MAX_LIGHTS];
        uniform int uNumLights;
        uniform mat4 uVMatrix;

        uniform bool uLightingEnabled;

        void main(void) {
            if (!uLightingEnabled) {
                gl_FragColor = vec4(vDiffuse, 1.0);
            } else {
                vec3 N = normalize(vNormal);
                vec3 V = normalize(-vPosition);
                vec3 totalColor = vec3(0.0);

                for (int i = 0; i < MAX_LIGHTS; i++) {
                    if (i >= uNumLights) break;

                    vec3 lightPosEye = (uVMatrix * vec4(uLights[i].position, 1.0)).xyz;
                    vec3 L = normalize(lightPosEye - vPosition);
                    vec3 H = normalize(L + V);

                    vec3 ambient = vAmbient * uLights[i].ambient;

                    float diff = max(dot(N, L), 0.0);
                    vec3 diffuse = diff * (vDiffuse * uLights[i].diffuse);

                    float spec = pow(max(dot(N, H), 0.0), vShininess);
                    if (diff <= 0.0) spec = 0.0;
                    vec3 specular = spec * (vSpecular * uLights[i].specular);

                    totalColor += (ambient + diffuse + specular);
                }

                gl_FragColor = vec4(totalColor, 1.0);
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
                vMatrixUniform = gl.getUniformLocation(shaderProgram, "uVMatrix");
                lightingEnabledUniform = gl.getUniformLocation(shaderProgram, "uLightingEnabled");
                numLightsUniform = gl.getUniformLocation(shaderProgram, "uNumLights");

                for (var l = 0; l < MAX_LIGHTS; l++) {
                    lightUniforms.push({
                        position: gl.getUniformLocation(shaderProgram, "uLights[" + l + "].position"),
                        ambient: gl.getUniformLocation(shaderProgram, "uLights[" + l + "].ambient"),
                        diffuse: gl.getUniformLocation(shaderProgram, "uLights[" + l + "].diffuse"),
                        specular: gl.getUniformLocation(shaderProgram, "uLights[" + l + "].specular")
                    });
                }
            }
        }
    } 
    catch(e) {
        console.log(e);
    }

    updateProjectionMatrix();
} 

function updateProjectionMatrix() {
    mat4.frustum(pMatrix, winLeft, winRight, winBottom, winTop, nearDist, farDist);
}

function setupUI() {
    var updateViewportBtn = document.getElementById("updateViewportBtn");
    if (updateViewportBtn) {
        updateViewportBtn.addEventListener("click", function() {
            var w = parseInt(document.getElementById("canvasWidth").value);
            var h = parseInt(document.getElementById("canvasHeight").value);
            if (w > 0 && h > 0) {
                var canvas = document.getElementById("myWebGLCanvas");
                canvas.width = w;
                canvas.height = h;
                gl.viewport(0, 0, w, h);
            }
        });
    }

    var updateProjBtn = document.getElementById("updateProjectionBtn");
    if (updateProjBtn) {
        updateProjBtn.addEventListener("click", function() {
            winLeft = parseFloat(document.getElementById("winLeft").value);
            winRight = parseFloat(document.getElementById("winRight").value);
            winBottom = parseFloat(document.getElementById("winBottom").value);
            winTop = parseFloat(document.getElementById("winTop").value);
            updateProjectionMatrix();
        });
    }
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

        // --- PART 10: TOGGLE CUSTOM SKETCH ANIMATION SCENE (!) ---
        if (key === '!' || (key === '1' && event.shiftKey)) {
            isFootballMode = !isFootballMode;
            rollDistance = 0.0;
            rollAngle = 0.0;
            isKickAnimating = false;

            if (isFootballMode) {
                // Raised Camera Angle looking slightly down at goalpost and ball
                eye = vec3.fromValues(0.5, 0.7, -0.4);
                center = vec3.fromValues(0.5, 0.2, 2.0);
            } else {
                // Restore Default Camera
                eye = vec3.clone(defaultEye);
                center = vec3.clone(defaultCenter);
            }
            console.log("Part 10 Custom Scene Active: " + isFootballMode);
            event.preventDefault();
            return;
        }

        // --- PART 10: INTERACTIVE 'g' KEY TO KICK BALL TO GOAL ---
        if ((key === 'g' || key === 'G') && isFootballMode) {
            isKickAnimating = true;
            rollDistance = 0.0;
            rollAngle = 0.0;
            console.log("Ball Kicked!");
            event.preventDefault();
            return;
        }

        // Camera Controls
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

        // Camera Rotations
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

        // Model Selection
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

        // Model Transformations
        else if (selectedIndex !== -1) {
            var curSet = triangleSets[selectedIndex];
            var modelTranslateStep = 0.05;
            var modelRotateStep = 0.05;

            if (key === 'k') { 
                vec3.scaleAndAdd(curSet.translation, curSet.translation, viewX, -modelTranslateStep);
                event.preventDefault();
            } else if (key === ';') { 
                vec3.scaleAndAdd(curSet.translation, curSet.translation, viewX, modelTranslateStep);
                event.preventDefault();
            } else if (key === 'o') { 
                vec3.scaleAndAdd(curSet.translation, curSet.translation, viewZ, modelTranslateStep);
                event.preventDefault();
            } else if (key === 'l') { 
                vec3.scaleAndAdd(curSet.translation, curSet.translation, viewZ, -modelTranslateStep);
                event.preventDefault();
            } else if (key === 'i') { 
                vec3.scaleAndAdd(curSet.translation, curSet.translation, viewY, modelTranslateStep);
                event.preventDefault();
            } else if (key === 'p') { 
                vec3.scaleAndAdd(curSet.translation, curSet.translation, viewY, -modelTranslateStep);
                event.preventDefault();
            } 
            
            else {
                let tempRot = mat4.create();
                let hasRotated = false;

                if (key === 'K') { 
                    mat4.rotate(tempRot, tempRot, modelRotateStep, viewY);
                    hasRotated = true;
                    event.preventDefault();
                } else if (key === ':') { 
                    mat4.rotate(tempRot, tempRot, -modelRotateStep, viewY);
                    hasRotated = true;
                    event.preventDefault();
                } else if (key === 'O') { 
                    mat4.rotate(tempRot, tempRot, modelRotateStep, viewX);
                    hasRotated = true;
                    event.preventDefault();
                } else if (key === 'L') { 
                    mat4.rotate(tempRot, tempRot, -modelRotateStep, viewX);
                    hasRotated = true;
                    event.preventDefault();
                } else if (key === 'I') { 
                    mat4.rotate(tempRot, tempRot, modelRotateStep, viewZ);
                    hasRotated = true;
                    event.preventDefault();
                } else if (key === 'P') { 
                    mat4.rotate(tempRot, tempRot, -modelRotateStep, viewZ);
                    hasRotated = true;
                    event.preventDefault();
                }

                if (hasRotated) {
                    mat4.multiply(curSet.rotationMatrix, tempRot, curSet.rotationMatrix);
                }
            }
        }
    });
}

function renderTriangles() {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); 

    var lightingEnabled = document.getElementById("lightingCheck").checked;

    mat4.lookAt(vMatrix, eye, center, up);

    // Ball Kick & Roll Animation Progress
    if (isFootballMode && isKickAnimating) {
        var targetZ = 1.6; // Stop point inside goal post
        if (rollDistance < targetZ) {
            rollDistance += 0.02;
            rollAngle += 0.22;
        } else {
            isKickAnimating = false; // Ball reached goal post
        }
    }

    var numLightsToPass = Math.min(inputLights.length, MAX_LIGHTS);
    gl.uniform1i(numLightsUniform, numLightsToPass);
    gl.uniformMatrix4fv(vMatrixUniform, false, vMatrix);

    for (var l = 0; l < numLightsToPass; l++) {
        var light = inputLights[l];
        gl.uniform3f(lightUniforms[l].position, light.x, light.y, light.z);
        gl.uniform3fv(lightUniforms[l].ambient, light.ambient);
        gl.uniform3fv(lightUniforms[l].diffuse, light.diffuse);
        gl.uniform3fv(lightUniforms[l].specular, light.specular);
    }

    var renderSets = isFootballMode ? customSceneSets : triangleSets;

    for (var i = 0; i < renderSets.length; i++) {
        var tSet = renderSets[i];

        var mMatrix = mat4.create();

        if (isFootballMode) {
            // --- SKETCH-ACCURATE UNBLOCKED VIEW LAYOUT ---
            if (i === 0) {
                // 0: Ball - Shifted to center-left (X = 0.45), rolls straight to goal
                var ballZ = 0.2 + rollDistance;
                mat4.translate(mMatrix, mMatrix, vec3.fromValues(0.45, 0.08, ballZ));
                mat4.rotateX(mMatrix, mMatrix, rollAngle);
            } else if (i === 1) {
                // 1: Head (Shifted to right side X = 0.85)
                mat4.translate(mMatrix, mMatrix, vec3.fromValues(0.85, 0.48, 0.2));
            } else if (i === 2) {
                // 2: Torso (Red Shirt)
                mat4.translate(mMatrix, mMatrix, vec3.fromValues(0.85, 0.32, 0.2));
                mat4.scale(mMatrix, mMatrix, vec3.fromValues(0.12, 0.22, 0.1));
            } else if (i === 3) {
                // 3: Left Arm (Raised)
                mat4.translate(mMatrix, mMatrix, vec3.fromValues(0.76, 0.38, 0.2));
                mat4.rotateZ(mMatrix, mMatrix, 0.6);
                mat4.scale(mMatrix, mMatrix, vec3.fromValues(0.04, 0.18, 0.04));
            } else if (i === 4) {
                // 4: Right Arm (Raised)
                mat4.translate(mMatrix, mMatrix, vec3.fromValues(0.94, 0.38, 0.2));
                mat4.rotateZ(mMatrix, mMatrix, -0.6);
                mat4.scale(mMatrix, mMatrix, vec3.fromValues(0.04, 0.18, 0.04));
            } else if (i === 5) {
                // 5: Left Leg (Standing Leg)
                mat4.translate(mMatrix, mMatrix, vec3.fromValues(0.80, 0.12, 0.2));
                mat4.rotateZ(mMatrix, mMatrix, 0.15);
                mat4.scale(mMatrix, mMatrix, vec3.fromValues(0.06, 0.22, 0.06));
            } else if (i === 6) {
                // 6: Right Leg (Kicking Leg - Swings forward when 'g' pressed)
                var legSwing = isKickAnimating ? Math.sin(Math.min(rollDistance * 4.0, Math.PI / 2)) * 0.8 : 0.0;
                mat4.translate(mMatrix, mMatrix, vec3.fromValues(0.90, 0.12, 0.2));
                mat4.rotateX(mMatrix, mMatrix, -legSwing);
                mat4.scale(mMatrix, mMatrix, vec3.fromValues(0.06, 0.22, 0.06));
            } else if (i === 7) {
                // 7: Goalpost Left Post
                mat4.translate(mMatrix, mMatrix, vec3.fromValues(0.15, 0.28, 1.8));
                mat4.scale(mMatrix, mMatrix, vec3.fromValues(0.03, 0.5, 0.03));
            } else if (i === 8) {
                // 8: Goalpost Right Post
                mat4.translate(mMatrix, mMatrix, vec3.fromValues(0.75, 0.28, 1.8));
                mat4.scale(mMatrix, mMatrix, vec3.fromValues(0.03, 0.5, 0.03));
            } else if (i === 9) {
                // 9: Goalpost Top Bar
                mat4.translate(mMatrix, mMatrix, vec3.fromValues(0.45, 0.53, 1.8));
                mat4.scale(mMatrix, mMatrix, vec3.fromValues(0.63, 0.03, 0.03));
            } else if (i === 10) {
                // 10: Pitch Turf Ground
                mat4.translate(mMatrix, mMatrix, vec3.fromValues(0.5, -0.01, 1.0));
                mat4.scale(mMatrix, mMatrix, vec3.fromValues(2.0, 0.02, 2.5));
            }
        } else {
            // Standard Parts 1-9 Transformations
            mat4.translate(mMatrix, mMatrix, tSet.translation);
            mat4.translate(mMatrix, mMatrix, tSet.center);

            if (tSet.isHighlighted) {
                mat4.scale(mMatrix, mMatrix, vec3.fromValues(1.2, 1.2, 1.2));
            }

            mat4.multiply(mMatrix, mMatrix, tSet.rotationMatrix);

            var negCenter = vec3.create();
            vec3.negate(negCenter, tSet.center);
            mat4.translate(mMatrix, mMatrix, negCenter);
        }

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
  loadLights();
  loadTriangles(); 
  setupShaders(); 
  setupUI();
  setupEvents(); 
  renderTriangles(); 
}
