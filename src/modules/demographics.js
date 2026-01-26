// src/modules/demographics.js

let activeDemographics = null;

export function loadSavedDemographics() {
    const saved = localStorage.getItem('activeDemographics');
    if (saved) {
        try {
            activeDemographics = JSON.parse(saved);

            // Populate form if elements exist
            if (document.getElementById('demo-id')) {
                document.getElementById('demo-id').value = activeDemographics.participant_id || '';
                document.getElementById('demo-age').value = activeDemographics.age || '';
                document.getElementById('demo-gender').value = activeDemographics.gender || '';

                const dlCat = document.getElementById('demo-DLcategory');
                if (dlCat) dlCat.value = activeDemographics.dl_category || '';

                const dlExp = document.getElementById('demo-DLexperience');
                if (dlExp) dlExp.value = activeDemographics.dl_experience || '';

                document.getElementById('demo-notes').value = activeDemographics.notes || '';
            }
        } catch (e) {
            console.error("Error loading demographics:", e);
        }
    }
}

export function saveDemographicsFromForm() {
    const id = document.getElementById('demo-id').value.trim();
    const age = document.getElementById('demo-age').value;
    const gender = document.getElementById('demo-gender').value;
    const dlCat = document.getElementById('demo-DLcategory').value;
    const dlExp = document.getElementById('demo-DLexperience').value;
    const notes = document.getElementById('demo-notes').value;

    if (!id) {
        alert("Proszę podać przynajmniej Identyfikator (Kod)!");
        return;
    }

    activeDemographics = {
        participant_id: id,
        age: age,
        gender: gender,
        dl_category: dlCat,
        dl_experience: dlExp,
        notes: notes,
        filled_at: new Date().toISOString()
    };

    localStorage.setItem('activeDemographics', JSON.stringify(activeDemographics));

    const statusSpan = document.getElementById('demo-status');
    if (statusSpan) {
        statusSpan.style.display = 'inline';
        statusSpan.innerText = "Zapisano!";
        setTimeout(() => { statusSpan.style.display = 'none'; }, 3000);
    }
}

export function getActiveDemographics() {
    if (!activeDemographics) {
        // Fallback check
        const saved = localStorage.getItem('activeDemographics');
        if (saved) {
            try {
                activeDemographics = JSON.parse(saved);
            } catch (e) { }
        }
    }
    return activeDemographics;
}
