# NaOCl Storage v4

Εφαρμογή για GitHub Pages.

## Ανέβασμα στο GitHub
Ανέβασε όλα τα αρχεία στη ρίζα του repository:

- index.html
- style.css
- app.js
- manifest.json
- sw.js
- README.md

Μετά: Settings → Pages → Deploy from branch → main → / root.

## Τι κάνει
- Παραγωγή kg/hr
- Πραγματικά m, Max m, tn/m για κάθε δεξαμενή
- Σειρά γεμίσματος 1,2,3...
- Χρόνο γεμίσματος ανά δεξαμενή
- Σύνολο τόνων τώρα
- Πότε γεμίζουν όλες
- Κουμπί MAX και EMPTY
- Αποθήκευση στη συσκευή με localStorage
- PWA / installable από κινητό


## Διόρθωση δεκαδικών
Τα πεδία δέχονται και τελεία και κόμμα, π.χ. 6.54 ή 6,54.


## v4 comma-fix-2
- Δέχεται δεκαδικά με κόμμα ή τελεία: 6,54 και 6.54.
- Δεν ξαναγράφει τα πεδία όσο πληκτρολογείς.
- Νέο service worker ώστε να μην κρατάει παλιά έκδοση cache στο κινητό.
