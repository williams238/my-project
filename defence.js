// Wait until the whole HTML page has loaded before running any code
document.addEventListener('DOMContentLoaded', () => {

    /* ========== 1. GRAB THE HTML ELEMENTS WE NEED ========== */
    const form = document.getElementById('patient-form');
    const tableBody = document.getElementById('patientTableBody');
    const searchInput = document.getElementById('searchInput');
    const statusFilter = document.getElementById('statusFilter');
    const departmentSelect = document.getElementById('patientDept');
    const doctorSelect = document.getElementById('patientDoctor');
    const toastBox = document.getElementById('toast');

    /* ========== 2. FIXED DATA ========== */
    // The order a patient moves through (position matters: 0, 1, 2)
    const STATUSES = ['WAITING', 'CONSULTING', 'COMPLETED'];

    // The 4 doctors. They never change, so they are not saved in localStorage.
    const DOCTORS = [
        { name: 'Dr. Adeyemi', dept: 'General' },
        { name: 'Dr. Ibrahim', dept: 'General' },
        { name: 'Dr. Bello', dept: 'Dental' },
        { name: 'Dr. Okafor', dept: 'Pediatrics' }
    ];

    /* ========== 3. STORAGE (localStorage only holds text) ========== */
    // Read saved patients. If nothing is saved (or the data is damaged), start with an empty list.
    function loadPatients() {
        try {
            const saved = JSON.parse(localStorage.getItem('clinic_patients'));
            return Array.isArray(saved) ? saved : [];
        } catch {
            return [];
        }
    }

    // Turn the patients array into text and store it
    function savePatients() {
        localStorage.setItem('clinic_patients', JSON.stringify(patients));
    }

    // The main data of the whole app: a list of patient objects
    let patients = loadPatients();

    /* ========== 4. SMALL HELPER FUNCTIONS ========== */
    // Make user text safe before putting it into the page (stops typed HTML from running)
    function esc(text) {
        return String(text ?? '').replace(/[&<>"']/g, (c) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
    }

    // Today's date as text, like "2026-10-20"
    function today() {
        return new Date().toISOString().slice(0, 10);
    }

    // Next patient ID: take the highest number used so far and add 1 (P001, P002, ...)
    function nextId() {
        const numbers = patients.map((p) => parseInt(String(p.id).slice(1), 10) || 0);
        return 'P' + String(Math.max(0, ...numbers) + 1).padStart(3, '0');
    }

    // Show a small message at the bottom-right for 3 seconds
    let toastTimer;
    function showToast(message, type = 'success') {
        toastBox.textContent = message;
        toastBox.className = 'toast show ' + type;
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toastBox.classList.remove('show'), 3000);
    }

    // Wait until the user stops typing for 400ms before running a function
    function debounce(fn, delay = 400) {
        let timer;
        return (...args) => {
            clearTimeout(timer);
            timer = setTimeout(() => fn(...args), delay);
        };
    }

    /* ========== 5. DOCTOR DROPDOWN ========== */
    // Fill the "Assigned Doctor" dropdown with doctors from the chosen department
    function fillDoctorOptions() {
        const dept = departmentSelect.value;

        if (!dept) {
            doctorSelect.innerHTML = '<option value="">Select department first</option>';
            return;
        }

        const matching = DOCTORS.filter((d) => d.dept === dept);
        doctorSelect.innerHTML = '<option value="">Select doctor</option>' +
            matching.map((d) => `<option value="${esc(d.name)}">${esc(d.name)}</option>`).join('');
    }

    /* ========== 6. STAT CARDS ========== */
    // Count things in the patients array and show the numbers
    function updateStats() {
        document.getElementById('statTotal').textContent = patients.length;
        document.getElementById('statToday').textContent =
            patients.filter((p) => p.createdAt === today()).length;
        document.getElementById('statPending').textContent =
            patients.filter((p) => p.status === 'WAITING').length;
        document.getElementById('statCompleted').textContent =
            patients.filter((p) => p.status === 'COMPLETED').length;
    }

    /* ========== 7. DRAW THE TABLE ========== */
    // The table is always redrawn from the patients array
    function renderTable() {
        const query = searchInput.value.trim().toLowerCase();
        const status = statusFilter.value;

        // Keep only patients that match the search text AND the chosen status
        const visible = patients.filter((p) => {
            const matchesText =
                p.name.toLowerCase().includes(query) ||
                p.dept.toLowerCase().includes(query) ||
                p.id.toLowerCase().includes(query);
            return matchesText && (!status || p.status === status);
        });

        if (visible.length === 0) {
            const message = patients.length === 0
                ? 'No patients yet. Register one using the form.'
                : 'No matching patients found.';
            tableBody.innerHTML = `<tr class="empty-row"><td colspan="9">${message}</td></tr>`;
        } else {
            // Turn each patient into one table row of HTML, then join them together
            tableBody.innerHTML = visible.map((p) => `
                <tr>
                    <td>${esc(p.id)}</td>
                    <td>${esc(p.name)}</td>
                    <td>${esc(p.age)}</td>
                    <td>${esc(p.gender || '—')}</td>
                    <td>${esc(p.dept)}</td>
                    <td>${esc(p.doctor || '—')}</td>
                    <td>${esc(p.problem)}</td>
                    <td><span class="status-badge ${esc(p.status.toLowerCase())}">${esc(p.status)}</span></td>
                    <td>
                        <button class="btn-action" data-action="next" data-id="${esc(p.id)}"
                            ${p.status === 'COMPLETED' ? 'disabled' : ''}>Next Status</button>
                        <button class="btn-action btn-danger" data-action="discharge" data-id="${esc(p.id)}">Discharge</button>
                    </td>
                </tr>`).join('');
        }

        updateStats();
    }

    /* ========== 8. TABLE BUTTONS (one listener for every row) ========== */
    tableBody.addEventListener('click', (e) => {
        // Find which button was clicked (if any)
        const button = e.target.closest('button[data-action]');
        if (!button) return;

        // Find the patient by ID (the button carries it in data-id)
        const patient = patients.find((p) => p.id === button.dataset.id);
        if (!patient) return;

        if (button.dataset.action === 'next') {
            // Move to the next status in the STATUSES list
            const position = STATUSES.indexOf(patient.status);
            if (position < STATUSES.length - 1) {
                patient.status = STATUSES[position + 1];
            }
            savePatients();
            renderTable();
            showToast(`${patient.name} is now ${patient.status.toLowerCase()}.`);
        }

        if (button.dataset.action === 'discharge') {
            if (!confirm(`Discharge ${patient.name}?`)) return;
            // Keep everyone except this patient
            patients = patients.filter((p) => p.id !== patient.id);
            savePatients();
            renderTable();
            showToast(`${patient.name} was discharged.`);
        }
    });

    /* ========== 9. REGISTER A NEW PATIENT ========== */
    form.addEventListener('submit', (e) => {
        e.preventDefault(); // stop the page from reloading

        // Read what the user typed
        const name = document.getElementById('patientName').value.trim();
        const age = parseInt(document.getElementById('patientAge').value, 10);
        const gender = document.getElementById('patientGender').value;
        const phone = document.getElementById('patientPhone').value.trim();
        const dept = document.getElementById('patientDept').value;
        const doctor = document.getElementById('patientDoctor').value;
        const problem = document.getElementById('patientProblem').value.trim();

        // Checks: each failed check shows an error and stops (return)
        if (!name) return showToast('Enter the patient\'s full name.', 'error');
        if (isNaN(age) || age < 0 || age > 120) return showToast('Enter a valid age between 0 and 120.', 'error');
        if (!gender) return showToast('Select the patient\'s gender.', 'error');
        if (!/^\d{11}$/.test(phone)) return showToast('Phone number must be exactly 11 digits.', 'error');
        if (!dept) return showToast('Select a department.', 'error');
        if (dept === 'Pediatrics' && age > 18) return showToast('Pediatrics is for patients aged 0 to 18.', 'error');
        if (!doctor) return showToast('Select a doctor for this patient.', 'error');
        if (!problem) return showToast('Describe the patient\'s problem or symptoms.', 'error');

        // All checks passed: add the patient, save, redraw
        patients.push({
            id: nextId(),
            name, age, gender, phone, dept, doctor, problem,
            status: 'WAITING',
            createdAt: today()
        });

        savePatients();
        renderTable();
        form.reset();
        showToast('Patient registered successfully.');
    });

    /* ========== 10. OTHER LISTENERS ========== */
    // Changing the department refreshes the doctor dropdown
    departmentSelect.addEventListener('change', fillDoctorOptions);

    // "Clear Form" also resets the doctor dropdown (wait one tick: the fields clear after this event)
    form.addEventListener('reset', () => setTimeout(fillDoctorOptions, 0));

    // Search waits 400ms after typing stops; the status filter reacts immediately
    searchInput.addEventListener('input', debounce(renderTable, 400));
    statusFilter.addEventListener('change', renderTable);

    /* ========== 11. RUN ONCE WHEN THE PAGE OPENS ========== */
    fillDoctorOptions();
    renderTable();
});