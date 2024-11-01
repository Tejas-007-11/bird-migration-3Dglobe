let scene, camera, renderer, globe, raycaster, mouse, controls;
let lines = []; // To store bird migration lines
let hoverInfo = document.getElementById('tooltip'); // Tooltip for hover info
let dropdown = document.getElementById('dropdown'); // Dropdown for bird names

// Fetch bird data from JSON file
async function loadBirdData() {
    try {
        const response = await fetch('Birdmigration.json'); // Path to JSON file
        if (!response.ok) throw new Error('Failed to load bird data');
        const birdData = await response.json();
        initialize(birdData);
    } catch (error) {
        console.error('Error loading bird data:', error);
    }
}

function initialize(birdData) {
    // Scene setup
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.getElementById('globe-container').appendChild(renderer.domElement);

    // Load the Earth texture
    const textureLoader = new THREE.TextureLoader();
    const earthTexture = textureLoader.load('images/earth_texture3.jpg'); // Ensure correct path
    const geometry = new THREE.SphereGeometry(5.5, 64, 64);
    const material = new THREE.MeshBasicMaterial({ map: earthTexture });
    globe = new THREE.Mesh(geometry, material);
    scene.add(globe);

    camera.position.z = 15;

    // Smooth Orbit Controls
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.15;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.5;
    controls.enableZoom = true;
    controls.minDistance = 7;
    controls.maxDistance = 20;

    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();

    // Set up event listeners
    window.addEventListener('mousemove', onMouseMove, false);
    window.addEventListener('resize', onWindowResize, false);
    document.getElementById('search-btn').addEventListener('click', () => onSearch(birdData));
    document.getElementById('bird-input').addEventListener('input', () => showDropdown(birdData));
    document.addEventListener('click', hideDropdown);
    animate();
}

function showDropdown(birdData) {
    const inputVal = document.getElementById('bird-input').value.toLowerCase();
    dropdown.innerHTML = ''; 
    dropdown.style.display = 'none'; 

    const filteredBirds = birdData.filter(data => data.bird.toLowerCase().includes(inputVal));

    if (filteredBirds.length > 0) {
        dropdown.style.display = 'block'; 
        filteredBirds.forEach(bird => {
            const li = document.createElement('li');
            li.textContent = bird.bird;
            li.onclick = () => selectBird(bird.bird); 
            dropdown.appendChild(li);
        });
    }
}

function selectBird(birdName) {
    document.getElementById('bird-input').value = birdName; 
    dropdown.style.display = 'none';
}

function hideDropdown(event) {
    if (!dropdown.contains(event.target) && event.target.id !== 'bird-input') {
        dropdown.style.display = 'none';
    }
}

function drawCurvedLines(data) {
    // Clear existing lines from the scene and the lines array
    while (lines.length) {
        const line = lines.pop();
        scene.remove(line);
    }

    data.forEach(route => {
        const start = convertLatLonToXYZ(route.from.lat, route.from.lon, 5.2);
        const end = convertLatLonToXYZ(route.to.lat, route.to.lon, 5.2);

        const controlPointHeight = 6;
        const midPoint = new THREE.Vector3().lerpVectors(start, end, 0.5);
        midPoint.normalize().multiplyScalar(controlPointHeight);

        const curve = new THREE.CatmullRomCurve3([start, midPoint, end]);
        const points = curve.getPoints(50);
        const geometry = new THREE.BufferGeometry().setFromPoints(points);

        // Create material with an initial color
        const material = new THREE.LineBasicMaterial({
            color: 0xff0000, // Initial color
            linewidth: 12     // Line thickness
        });

        const line = new THREE.Line(geometry, material);
        lines.push(line);
        scene.add(line);

        // Colors to cycle through
        const colors = [0xff4500, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff, 0x00ffff];
        let colorIndex = 0;

        // Function to change color every second
        function changeLineColor() {
            material.color.setHex(colors[colorIndex]); // Change color
            colorIndex = (colorIndex + 1) % colors.length; // Cycle through colors
            setTimeout(changeLineColor, 1000); // Repeat every second
        }
        
        changeLineColor(); // Start the color-changing effect
    });
}

function convertLatLonToXYZ(lat, lon, radius) {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lon + 180) * (Math.PI / 180);
    return new THREE.Vector3(
        -(radius * Math.sin(phi) * Math.cos(theta)),
        radius * Math.cos(phi),
        radius * Math.sin(phi) * Math.sin(theta)
    );
}

function onSearch(birdData) {
    const birdName = document.getElementById('bird-input').value.toLowerCase();
    const selectedBirdData = birdData.filter(data => data.bird.toLowerCase() === birdName);

    if (selectedBirdData.length > 0) {
        drawCurvedLines(selectedBirdData);
        const start = convertLatLonToXYZ(selectedBirdData[0].from.lat, selectedBirdData[0].from.lon, 5.5);
        const end = convertLatLonToXYZ(selectedBirdData[0].to.lat, selectedBirdData[0].to.lon, 5.5);
        const midPoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
        moveCameraTo(midPoint.clone().add(new THREE.Vector3(0, 0, 5)), midPoint);
        hideDropdown();
    } else {
        alert('No data found for the selected bird.');
        hideDropdown();
    }
}

function moveCameraTo(targetPosition, lookAtPosition) {
    const duration = 1;
    const startPosition = camera.position.clone();
    const startTime = performance.now();

    function animateMove() {
        const elapsed = (performance.now() - startTime) / 1000;
        const progress = Math.min(elapsed / duration, 1);
        camera.position.lerpVectors(startPosition, targetPosition, progress);
        camera.lookAt(lookAtPosition);
        controls.update();
        if (progress < 1) requestAnimationFrame(animateMove);
    }

    animateMove();
}

function onMouseMove(event) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = - (event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);

    const intersects = raycaster.intersectObjects(lines);
    if (intersects.length > 0) {
        const intersectedLine = intersects[0].object;
        hoverInfo.style.display = 'block';
        hoverInfo.textContent = `${intersectedLine.userData.bird} from ${intersectedLine.userData.from.lat}, ${intersectedLine.userData.from.lon} to ${intersectedLine.userData.to.lat}, ${intersectedLine.userData.to.lon}`;
        hoverInfo.style.left = `${event.clientX + 10}px`;
        hoverInfo.style.top = `${event.clientY - 30}px`;
    } else {
        hoverInfo.style.display = 'none';
    }
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

loadBirdData(); // Start loading data and initialization


