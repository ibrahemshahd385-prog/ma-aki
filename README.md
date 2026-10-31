# Ma'aki · معاكِ

A breast cancer awareness and follow-up app for Pink October. Ma'aki walks with a woman from the first doubt to diagnosis, treatment and follow-up, and connects her with her doctor in one place.

**Important:** this is a research prototype. It is not a medical device. The AI readings are decision support for the doctor only, and the doctor makes every diagnosis.

<div dir="rtl">

**نبذة بالعربي:** «معاكِ» تطبيق بيمشي مع الست من أول ما تشك لحد العلاج والمتابعة، وبيربطها بدكتورها في مكان واحد. فيه تقييم سريع للأعراض وعوامل الخطورة، ورفع للأشعة والتحاليل، ونموذج ذكاء اصطناعي بيقرا الماموجرام والسونار ويوصّل القراءة للدكتور بس. وفيه كمان متابعة للعلاج والأدوية والأعراض، ومساعدة اسمها «ونس». الذكاء الاصطناعي بيساعد الدكتور، ومش بيشخّص.

</div>

## The patient journey

1. **Doubt:** she notices a change, or it is time for her monthly self-exam.
2. **Assessment:** 8 questions about symptoms and risk factors, plus age and chronic conditions.
   - Low result: a monthly self-exam with reminders.
   - Medium or high result, or a warning sign: see a doctor.
3. **Doctor visit:** she links her account to her doctor's code.
4. **Tests:** mammogram, ultrasound and lab reports. The AI reading goes to the doctor only.
5. **Diagnosis:** the doctor reviews the results and confirms by biopsy.
   - Healthy or benign: regular follow-up.
   - Malignant: go on to step 6.
6. **Treatment and follow-up:** a treatment plan, medicine reminders, and symptoms that reach the doctor.

## Features

**For the patient**

- A quick risk assessment. It gives one of four levels (see a doctor soon, high, medium, low) and lists the factors behind it.
- A monthly self-exam guide and reminders.
- Linking to her doctor with the doctor's unique code, after she agrees to share her data.
- Uploads of mammograms, ultrasound and lab reports. She does not see the model's number: the doctor explains the result.
- During treatment:
  - her treatment plan
  - medicine reminders
  - a symptom diary
  - messages with her doctor
- **Wanas (ونس):** a supportive assistant that answers with written replies, and uses Claude for new questions.
- The whole app in Arabic and English.

**For the doctor**

- Patients sorted by priority: needs attention today, to review, or stable.
- A patient file with:
  - her assessment
  - her scans with the model reading
  - lab values against the normal ranges
  - her symptoms
  - her medicine adherence
- Confirming the diagnosis and choosing the treatment plan. The patient sees it right away.

## AI and rules in the app

| Part | How it works | Code |
|---|---|---|
| Scan model | ResNet50 features, then PCA and Logistic Regression. Mammogram and ultrasound are combined (details below). | `backend/app/ml/bcmid.py` |
| Lab report reading | Claude reads the values from a photo or PDF of the report. Fixed rules then compare them with reference ranges. | `backend/app/services/lab_reader.py`, `backend/app/labs.py` |
| Wanas | Written replies for known questions. Claude answers new questions on the server and gets no name, email or files. | `frontend/src/data/wanas.ts`, `backend/app/services/claude.py` |
| Assessment | Points rules, not machine learning, so any doctor can review them. | `frontend/src/data/assessment.ts` |
| Alerts and priority | Rules: a fever of 38 °C or more, pain of 7/10 or more, or urgent words in a message. | `frontend/src/data/clinic.ts` |
| Blood-test SVM (Coimbra) | Kept in the notebook only. It is not used in the app. | `model/maaki_models_reviewed.ipynb` |

The lab reference ranges come from the report itself when it prints them. Otherwise they come from:

- MedlinePlus: hemoglobin, white blood cells and platelets
- Mayo Clinic Laboratories: CA 15-3
- NCI CTCAE v5: neutrophils and the severe levels

## The scan model

- **Data:** BCMID v3 from Ayady Almostakbal Hospital, Alexandria, Egypt. It has 327 cases with mammogram and ultrasound images, and 63 of the cases are positive. License CC BY 4.0, DOI [10.5281/zenodo.19402690](https://doi.org/10.5281/zenodo.19402690).
- **Target:** the radiologist's BI-RADS. Positive is 4 to 6, negative is 1 to 3.
- **Pipeline:**
  1. **Image preparation:** the breast is cropped from the background. Mammograms become 672×672 and ultrasound images 224×224.
  2. **Feature extraction:** ResNet50 with ImageNet weights, used as is (frozen), gives 2048 features per image. Each mammogram is split into 3×3 tiles, and the strongest signal of the tiles with tissue is kept. A case is the mean of its images.
  3. **Scaling and PCA:** StandardScaler, then PCA to 50 features.
  4. **Logistic Regression:** with balanced class weights.
  5. **Fusion:** the mean of the mammogram and ultrasound probabilities. The threshold is 0.5.
- **Evaluation:** StratifiedGroupKFold split by patient, 5 folds × 3 repeats, so 15 runs (mean ± SD):

| Model | AUC | Sensitivity | Specificity |
|---|---|---|---|
| Fusion | 0.839 ± 0.058 | 0.52 | 0.92 |
| Mammogram only | 0.750 ± 0.052 | 0.51 | 0.90 |
| Ultrasound only | 0.754 ± 0.083 | 0.58 | 0.82 |

**Shortcut check:** on BCMID, side information alone (the number of images and the year) predicts the label with an AUC of 0.90. We therefore also measured AUC within groups that have the same image count and period. Fusion is 0.81 there, ultrasound 0.77 and mammogram 0.65.

**Limitations:**

- The data comes from one hospital and is small.
- The labels are BI-RADS ratings, not biopsy results.
- The ultrasound images contain the radiologist's caliper marks.
- The model is not yet tested on another hospital's data. The next step is CDD-CESM, from the National Cancer Institute, Cairo University.

The server runs exactly the same steps as the notebook, and `backend/check_model.py` checks that it gives the notebook's numbers.

## Tech stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS 4, Zustand, React Router and Supabase Auth.
- **Backend:** FastAPI, TensorFlow (ResNet50), NumPy, SciPy, Pillow, the Anthropic API (Claude) and PyJWT (to check Supabase sign-ins). The exported model runs with NumPy only.
- **Notebooks:** Google Colab, scikit-learn and TensorFlow.

## Project structure

```
frontend/                      React app for the patient and the doctor
backend/                       FastAPI server: scan model, lab reading, Wanas, shared clinic data
  app/
  models/maaki_app_models/     the exported scan model (numbers only)
  check_claude.py              checks the Claude key, model and connection
  check_model.py               checks that the server matches the notebook
model/
  maaki_models_reviewed.ipynb          training and evaluation (blood tests and scans)
  maaki_bcmid_zenodo_features.ipynb    image features from the BCMID archive on Zenodo
```

## Run it locally

**You need:**

- Python 3.12
- Node.js (LTS)
- A Supabase project with Email sign-in. Turn off "Confirm email" in Authentication → Sign In / Providers → Email.
- An Anthropic API key for Wanas and the lab report reading.

**1. Backend** (in a terminal, from the project folder):

```
cd backend
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
copy .env.example .env
.venv\Scripts\python -m uvicorn app.main:app --port 8000
```

On macOS or Linux, use `.venv/bin/python` and `cp .env.example .env`. Fill in `.env` before you start the server.

**2. Frontend** (in a second terminal):

```
cd frontend
npm install
copy .env.example .env.local
npm run dev
```

Fill in `.env.local`, then open http://localhost:5173.

**Environment variables:**

| File | Variable | What it is |
|---|---|---|
| `backend/.env` | `SUPABASE_URL` | Your Supabase project URL. Used to check sign-ins. |
| `backend/.env` | `ANTHROPIC_API_KEY` | The Claude API key. Secret: keep it only in this file. |
| `backend/.env` | `ALLOWED_ORIGINS` | Optional. Default `http://localhost:5173`. |
| `backend/.env` | `CLAUDE_MODEL` | Optional. Default `claude-sonnet-5-5`. |
| `frontend/.env.local` | `VITE_SUPABASE_URL` | The same Supabase project URL. |
| `frontend/.env.local` | `VITE_SUPABASE_PUBLISHABLE_KEY` | The Supabase publishable key. Safe in the browser. |
| `frontend/.env.local` | `VITE_API_URL` | Optional. Leave it empty to reach the backend through the Vite proxy. |

The backend saves the shared clinic data and the uploaded files in `backend/uploads/`. This is health data, so it is never added to Git.

## Retraining the model

1. Open `model/maaki_models_reviewed.ipynb` in Google Colab.
2. Put these files in Google Drive:
   - `dataR2.csv` from the UCI Breast Cancer Coimbra dataset
   - `BCMID_annotations.tsv` and the BCMID images from Zenodo
3. If Drive can't hold all the images, run `maaki_bcmid_zenodo_features.ipynb` first. It computes the features straight from the Zenodo archive.
4. Run the notebook. Its last part exports `bcmid_app_model.json` and `bcmid_heads.npz`.
5. Copy both files to `backend/models/maaki_app_models/`.

## Privacy and security

- Each patient sees only her own file. A doctor sees only the patients who linked to him and whom he accepted.
- Secret keys live only in `backend/.env`. They are never in the frontend or in this repository.
- Wanas sends Claude only the question and the last few messages, never her name, email or files.
- This repository contains no patient data.

## Data and credits

- **BCMID** v3, Ayady Almostakbal Hospital, Alexandria. CC BY 4.0, DOI [10.5281/zenodo.19402690](https://doi.org/10.5281/zenodo.19402690).
- **Breast Cancer Coimbra**, UCI Machine Learning Repository, CC BY 4.0. Patrício et al., "Using Resistin, glucose, age and BMI to predict the presence of breast cancer", *BMC Cancer*, 2018.
- **ResNet50** with ImageNet weights, from Keras.
- **Lab reference ranges** from MedlinePlus, Mayo Clinic Laboratories and NCI CTCAE v5.
