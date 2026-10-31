// The practice data from the prototype: one doctor (code MK-4821) and four patients in treatment,
// with their symptoms, lab results, messages and notes. Times are "days ago" (ago) or "in days" (inDays),
// so the demo always looks recent.
import type { Access, Alert, Doctor, Lab, MedLog, Message, Note, Patient, Symptom } from './clinic'

export type Tables = {
  doctors: Record<string, Doctor>
  patients: Record<string, Patient>
  messages: Record<string, Message>
  symptoms: Record<string, Symptom>
  labs: Record<string, Lab>
  notes: Record<string, Note>
  access: Record<string, Access>
  alerts: Record<string, Alert>
  medlogs: Record<string, MedLog>
}

export const DEMO_DOCTOR_ID = 'd_main'

export const SEED: Tables = {
  "doctors": {
    "d_main": {
      "id": "d_main",
      "name": "د. سارة عادل",
      "specialty": "جراحة وأورام الثدي",
      "hospital": "عيادة تجريبية",
      "code": "MK-4821",
      "hours": {
        "from": 10,
        "to": 16
      },
      "phone": "",
      "verified": true,
      "syndicateNo": "[رقم القيد]",
      "demo": true
    },
    "d_1937": {
      "id": "d_1937",
      "name": "د. مريم محمود",
      "specialty": "جراحة وأورام الثدي",
      "hospital": "عيادة خاصة",
      "code": "MK-1937",
      "hours": {
        "from": 10,
        "to": 16
      },
      "phone": "01012345678",
      "verified": true,
      "syndicateNo": "148290",
      "demo": false
    },
    "d_4539": {
      "id": "d_4539",
      "name": "د. أحمد كمال",
      "specialty": "جراحة وأورام الثدي",
      "hospital": "عيادة خاصة",
      "code": "MK-4539",
      "hours": {
        "from": 10,
        "to": 16
      },
      "phone": "01012345678",
      "verified": true,
      "syndicateNo": "145390",
      "demo": false
    }
  },
  "patients": {
    "p_salma": {
      "id": "p_salma",
      "name": "سلمى",
      "age": 42,
      "demo": true,
      "link": "active",
      "doctorId": "d_main",
      "chronic": [],
      "assessment": {
        "label": "يُنصح بكشف قريب",
        "level": "urgent",
        "factors": [
          "السن فوق 40",
          "كتلة ملحوظة في الثدي"
        ]
      },
      "prediction": {
        "birads": "BI-RADS 4C",
        "label": "اشتباه مرتفع",
        "demo": true
      },
      "uploads": [
        "ماموجرام",
        "سونار",
        "تقرير عيّنة"
      ],
      "diagnosis": {
        "result": "malignant",
        "stage": "IIA",
        "er": true,
        "pr": true,
        "her2": false,
        "grade": "2",
        "by": "د. سارة عادل"
      },
      "plan": {
        "template": "surgery_first",
        "steps": [
          {
            "id": "s0",
            "kind": "surgery",
            "title": "الجراحة",
            "inDays": -63,
            "status": "done"
          },
          {
            "id": "s1",
            "kind": "chemo",
            "title": "كيماوي: الجلسة 1 من 6",
            "inDays": -40,
            "status": "done"
          },
          {
            "id": "s2",
            "kind": "chemo",
            "title": "كيماوي: الجلسة 2 من 6",
            "inDays": -19,
            "status": "done"
          },
          {
            "id": "s3",
            "kind": "chemo",
            "title": "كيماوي: الجلسة 3 من 6",
            "inDays": 2,
            "status": "current"
          },
          {
            "id": "s4",
            "kind": "chemo",
            "title": "كيماوي: الجلسة 4 من 6",
            "inDays": 23,
            "status": "next"
          },
          {
            "id": "s5",
            "kind": "chemo",
            "title": "كيماوي: الجلسة 5 من 6",
            "inDays": 44,
            "status": "next"
          },
          {
            "id": "s6",
            "kind": "chemo",
            "title": "كيماوي: الجلسة 6 من 6",
            "inDays": 65,
            "status": "next"
          },
          {
            "id": "s7",
            "kind": "radio",
            "title": "إشعاع",
            "inDays": 93,
            "status": "next"
          },
          {
            "id": "s8",
            "kind": "hormone",
            "title": "علاج هرموني",
            "inDays": 135,
            "status": "next"
          },
          {
            "id": "s9",
            "kind": "followup",
            "title": "متابعة دورية",
            "inDays": 225,
            "status": "next"
          }
        ]
      },
      "meds": [
        {
          "id": "m1",
          "name": "مضاد للقيء",
          "dose": "قرص واحد",
          "times": [
            "08:00",
            "20:00"
          ],
          "note": "أول 3 أيام بعد كل جلسة"
        },
        {
          "id": "m2",
          "name": "فيتامين د",
          "dose": "قرص واحد",
          "times": [
            "14:00"
          ],
          "note": "بعد الغدا"
        }
      ],
      "appts": [
        {
          "id": "a1",
          "title": "صورة دم كاملة قبل الجلسة",
          "inDays": 1,
          "time": "09:00"
        },
        {
          "id": "a2",
          "title": "كيماوي: الجلسة 3 من 6",
          "inDays": 2,
          "time": "10:00"
        }
      ],
      "demoAdherence": 0.92
    },
    "p_mona": {
      "id": "p_mona",
      "name": "منى",
      "age": 55,
      "demo": true,
      "link": "active",
      "doctorId": "d_main",
      "chronic": [
        "سكر"
      ],
      "assessment": {
        "label": "احتمال مرتفع",
        "level": "high",
        "factors": [
          "السن فوق 50",
          "تاريخ عائلي من الدرجة الأولى"
        ]
      },
      "prediction": {
        "birads": "BI-RADS 4B",
        "label": "اشتباه متوسط",
        "demo": true
      },
      "uploads": [
        "ماموجرام",
        "تقرير عيّنة",
        "تحاليل دم"
      ],
      "diagnosis": {
        "result": "malignant",
        "stage": "IA",
        "er": true,
        "pr": true,
        "her2": false,
        "grade": "1",
        "by": "د. سارة عادل"
      },
      "plan": {
        "template": "surgery_radio",
        "steps": [
          {
            "id": "s0",
            "kind": "surgery",
            "title": "الجراحة",
            "inDays": -150,
            "status": "done"
          },
          {
            "id": "s1",
            "kind": "radio",
            "title": "إشعاع",
            "inDays": -110,
            "status": "done"
          },
          {
            "id": "s2",
            "kind": "hormone",
            "title": "علاج هرموني",
            "inDays": -40,
            "status": "current"
          },
          {
            "id": "s3",
            "kind": "followup",
            "title": "متابعة دورية",
            "inDays": 60,
            "status": "next"
          }
        ]
      },
      "meds": [
        {
          "id": "m1",
          "name": "علاج هرموني",
          "dose": "قرص واحد",
          "times": [
            "09:00"
          ],
          "note": "يوميًا"
        }
      ],
      "appts": [
        {
          "id": "a1",
          "title": "مراجعة في العيادة",
          "inDays": 9,
          "time": "11:00"
        }
      ],
      "demoAdherence": 0.86
    },
    "p_hoda": {
      "id": "p_hoda",
      "name": "هدى",
      "age": 38,
      "demo": true,
      "link": "active",
      "doctorId": "d_main",
      "chronic": [],
      "assessment": {
        "label": "يُنصح بكشف قريب",
        "level": "urgent",
        "factors": [
          "كتلة ملحوظة في الثدي"
        ]
      },
      "prediction": {
        "birads": "BI-RADS 5",
        "label": "اشتباه عالي",
        "demo": true
      },
      "uploads": [
        "سونار",
        "تقرير عيّنة"
      ],
      "diagnosis": {
        "result": "malignant",
        "stage": "IIB",
        "er": false,
        "pr": false,
        "her2": true,
        "grade": "3",
        "by": "د. سارة عادل"
      },
      "plan": {
        "template": "neo",
        "steps": [
          {
            "id": "s0",
            "kind": "chemo",
            "title": "كيماوي: الجلسة 1 من 6",
            "inDays": -35,
            "status": "done"
          },
          {
            "id": "s1",
            "kind": "chemo",
            "title": "كيماوي: الجلسة 2 من 6",
            "inDays": -14,
            "status": "done"
          },
          {
            "id": "s2",
            "kind": "chemo",
            "title": "كيماوي: الجلسة 3 من 6",
            "inDays": 7,
            "status": "current"
          },
          {
            "id": "s3",
            "kind": "chemo",
            "title": "كيماوي: الجلسة 4 من 6",
            "inDays": 28,
            "status": "next"
          },
          {
            "id": "s4",
            "kind": "chemo",
            "title": "كيماوي: الجلسة 5 من 6",
            "inDays": 49,
            "status": "next"
          },
          {
            "id": "s5",
            "kind": "chemo",
            "title": "كيماوي: الجلسة 6 من 6",
            "inDays": 70,
            "status": "next"
          },
          {
            "id": "s6",
            "kind": "surgery",
            "title": "الجراحة",
            "inDays": 105,
            "status": "next"
          },
          {
            "id": "s7",
            "kind": "radio",
            "title": "إشعاع",
            "inDays": 140,
            "status": "next"
          },
          {
            "id": "s8",
            "kind": "followup",
            "title": "متابعة دورية",
            "inDays": 230,
            "status": "next"
          }
        ]
      },
      "meds": [
        {
          "id": "m1",
          "name": "مضاد للقيء",
          "dose": "قرص واحد",
          "times": [
            "08:00",
            "20:00"
          ],
          "note": "أول 3 أيام بعد كل جلسة"
        }
      ],
      "appts": [
        {
          "id": "a1",
          "title": "كيماوي: الجلسة 3 من 6",
          "inDays": 7,
          "time": "10:00"
        }
      ],
      "demoAdherence": 1
    },
    "p_nadia": {
      "id": "p_nadia",
      "name": "نادية",
      "age": 61,
      "demo": true,
      "link": "active",
      "doctorId": "d_main",
      "chronic": [
        "ضغط"
      ],
      "assessment": {
        "label": "احتمال مرتفع",
        "level": "high",
        "factors": [
          "السن فوق 50",
          "تغيّر في الحجم أو الشكل"
        ]
      },
      "prediction": {
        "birads": "BI-RADS 4A",
        "label": "اشتباه منخفض–متوسط",
        "demo": true
      },
      "uploads": [
        "ماموجرام",
        "تقرير عيّنة"
      ],
      "diagnosis": {
        "result": "malignant",
        "stage": "IA",
        "er": true,
        "pr": false,
        "her2": false,
        "grade": "1",
        "by": "د. سارة عادل"
      },
      "plan": {
        "template": "surgery_radio",
        "steps": [
          {
            "id": "s0",
            "kind": "surgery",
            "title": "الجراحة",
            "inDays": -540,
            "status": "done"
          },
          {
            "id": "s1",
            "kind": "radio",
            "title": "إشعاع",
            "inDays": -470,
            "status": "done"
          },
          {
            "id": "s2",
            "kind": "hormone",
            "title": "علاج هرموني",
            "inDays": -440,
            "status": "current"
          },
          {
            "id": "s3",
            "kind": "followup",
            "title": "متابعة دورية + ماموجرام",
            "inDays": 5,
            "status": "next"
          }
        ]
      },
      "meds": [
        {
          "id": "m1",
          "name": "علاج هرموني",
          "dose": "قرص واحد",
          "times": [
            "21:00"
          ],
          "note": ""
        }
      ],
      "appts": [
        {
          "id": "a1",
          "title": "متابعة دورية + ماموجرام",
          "inDays": 5,
          "time": "12:00"
        }
      ],
      "demoAdherence": 0.97
    }
  },
  "messages": {
    "ms_salma_1": {
      "id": "ms_salma_1",
      "pid": "p_salma",
      "from": "doctor",
      "ago": 19,
      "text": "الجلسة التانية عدّت كويس. اشربي سوايل كتير وارتاحي يومين، ولو الحرارة 38 أو أكتر كلّميني فوراً.",
      "urgent": false,
      "readD": true,
      "readP": true,
      "demo": true
    },
    "ms_salma_2": {
      "id": "ms_salma_2",
      "pid": "p_salma",
      "from": "patient",
      "ago": 1.15,
      "text": "الحرارة كانت 38.2 امبارح بالليل ونزلت الصبح. أعمل إيه؟",
      "urgent": true,
      "readD": false,
      "readP": true,
      "demo": true
    },
    "ms_salma_3": {
      "id": "ms_salma_3",
      "pid": "p_salma",
      "from": "patient",
      "ago": 0.6,
      "text": "وكمان كنت عايزة أسأل: هل أقدر أرجع الشغل وقت العلاج؟",
      "urgent": false,
      "readD": false,
      "readP": true,
      "demo": true
    },
    "ms_mona_1": {
      "id": "ms_mona_1",
      "pid": "p_mona",
      "from": "patient",
      "ago": 0.5,
      "text": "رفعت تحليل CA 15-3 الجديد، وطالع عالي شوية. ده يقلق؟",
      "urgent": false,
      "readD": false,
      "readP": true,
      "demo": true
    },
    "ms_hoda_1": {
      "id": "ms_hoda_1",
      "pid": "p_hoda",
      "from": "patient",
      "ago": 3,
      "text": "شكراً يا دكتورة، الجلسة التانية كانت أهون من الأولى.",
      "urgent": false,
      "readD": true,
      "readP": true,
      "demo": true
    },
    "ms_hoda_2": {
      "id": "ms_hoda_2",
      "pid": "p_hoda",
      "from": "doctor",
      "ago": 2.9,
      "text": "الحمد لله، برافو عليكِ. كمّلي على نفس النظام.",
      "urgent": false,
      "readD": true,
      "readP": true,
      "demo": true
    }
  },
  "symptoms": {
    "sy_p_salma_00": {
      "id": "sy_p_salma_00",
      "pid": "p_salma",
      "ago": 13.3,
      "temp": 37.0,
      "pain": 2,
      "nausea": 1,
      "fatigue": 2,
      "mood": 1,
      "note": "",
      "source": "form",
      "demo": true
    },
    "sy_p_salma_01": {
      "id": "sy_p_salma_01",
      "pid": "p_salma",
      "ago": 12.3,
      "temp": 36.9,
      "pain": 2,
      "nausea": 1,
      "fatigue": 2,
      "mood": 1,
      "note": "",
      "source": "form",
      "demo": true
    },
    "sy_p_salma_02": {
      "id": "sy_p_salma_02",
      "pid": "p_salma",
      "ago": 11.3,
      "temp": 37.1,
      "pain": 1,
      "nausea": 1,
      "fatigue": 1,
      "mood": 1,
      "note": "",
      "source": "form",
      "demo": true
    },
    "sy_p_salma_03": {
      "id": "sy_p_salma_03",
      "pid": "p_salma",
      "ago": 10.3,
      "temp": 36.8,
      "pain": 1,
      "nausea": 0,
      "fatigue": 1,
      "mood": 0,
      "note": "",
      "source": "form",
      "demo": true
    },
    "sy_p_salma_04": {
      "id": "sy_p_salma_04",
      "pid": "p_salma",
      "ago": 9.3,
      "temp": 36.9,
      "pain": 1,
      "nausea": 0,
      "fatigue": 1,
      "mood": 0,
      "note": "",
      "source": "form",
      "demo": true
    },
    "sy_p_salma_05": {
      "id": "sy_p_salma_05",
      "pid": "p_salma",
      "ago": 8.3,
      "temp": 37.0,
      "pain": 1,
      "nausea": 0,
      "fatigue": 1,
      "mood": 0,
      "note": "",
      "source": "form",
      "demo": true
    },
    "sy_p_salma_06": {
      "id": "sy_p_salma_06",
      "pid": "p_salma",
      "ago": 7.3,
      "temp": 36.8,
      "pain": 0,
      "nausea": 0,
      "fatigue": 1,
      "mood": 0,
      "note": "",
      "source": "form",
      "demo": true
    },
    "sy_p_salma_07": {
      "id": "sy_p_salma_07",
      "pid": "p_salma",
      "ago": 6.3,
      "temp": 36.9,
      "pain": 1,
      "nausea": 0,
      "fatigue": 1,
      "mood": 0,
      "note": "",
      "source": "form",
      "demo": true
    },
    "sy_p_salma_08": {
      "id": "sy_p_salma_08",
      "pid": "p_salma",
      "ago": 5.3,
      "temp": 37.2,
      "pain": 1,
      "nausea": 0,
      "fatigue": 1,
      "mood": 1,
      "note": "",
      "source": "form",
      "demo": true
    },
    "sy_p_salma_09": {
      "id": "sy_p_salma_09",
      "pid": "p_salma",
      "ago": 4.3,
      "temp": 37.0,
      "pain": 2,
      "nausea": 1,
      "fatigue": 1,
      "mood": 1,
      "note": "",
      "source": "form",
      "demo": true
    },
    "sy_p_salma_10": {
      "id": "sy_p_salma_10",
      "pid": "p_salma",
      "ago": 3.3,
      "temp": 37.3,
      "pain": 2,
      "nausea": 1,
      "fatigue": 2,
      "mood": 1,
      "note": "",
      "source": "form",
      "demo": true
    },
    "sy_p_salma_11": {
      "id": "sy_p_salma_11",
      "pid": "p_salma",
      "ago": 2.3,
      "temp": 37.4,
      "pain": 2,
      "nausea": 1,
      "fatigue": 2,
      "mood": 2,
      "note": "",
      "source": "form",
      "demo": true
    },
    "sy_p_salma_12": {
      "id": "sy_p_salma_12",
      "pid": "p_salma",
      "ago": 1.2,
      "temp": 38.2,
      "pain": 3,
      "nausea": 1,
      "fatigue": 2,
      "mood": 2,
      "note": "حسيت برعشة بالليل",
      "source": "form",
      "demo": true
    },
    "sy_p_salma_13": {
      "id": "sy_p_salma_13",
      "pid": "p_salma",
      "ago": 0.3,
      "temp": 37.6,
      "pain": 2,
      "nausea": 0,
      "fatigue": 2,
      "mood": 1,
      "note": "",
      "source": "form",
      "demo": true
    },
    "sy_p_mona_00": {
      "id": "sy_p_mona_00",
      "pid": "p_mona",
      "ago": 10.2,
      "temp": 36.8,
      "pain": 1,
      "nausea": 0,
      "fatigue": 1,
      "mood": 1,
      "note": "",
      "source": "form",
      "demo": true
    },
    "sy_p_mona_01": {
      "id": "sy_p_mona_01",
      "pid": "p_mona",
      "ago": 6.2,
      "temp": 36.9,
      "pain": 2,
      "nausea": 0,
      "fatigue": 1,
      "mood": 1,
      "note": "",
      "source": "form",
      "demo": true
    },
    "sy_p_mona_02": {
      "id": "sy_p_mona_02",
      "pid": "p_mona",
      "ago": 3.2,
      "temp": 37.0,
      "pain": 1,
      "nausea": 0,
      "fatigue": 1,
      "mood": 0,
      "note": "",
      "source": "form",
      "demo": true
    },
    "sy_p_mona_03": {
      "id": "sy_p_mona_03",
      "pid": "p_mona",
      "ago": 1.1,
      "temp": 36.8,
      "pain": 1,
      "nausea": 0,
      "fatigue": 1,
      "mood": 1,
      "note": "",
      "source": "form",
      "demo": true
    },
    "sy_p_hoda_00": {
      "id": "sy_p_hoda_00",
      "pid": "p_hoda",
      "ago": 13.2,
      "temp": 37.1,
      "pain": 2,
      "nausea": 2,
      "fatigue": 2,
      "mood": 1,
      "note": "",
      "source": "form",
      "demo": true
    },
    "sy_p_hoda_01": {
      "id": "sy_p_hoda_01",
      "pid": "p_hoda",
      "ago": 11.2,
      "temp": 36.9,
      "pain": 1,
      "nausea": 1,
      "fatigue": 2,
      "mood": 1,
      "note": "",
      "source": "form",
      "demo": true
    },
    "sy_p_hoda_02": {
      "id": "sy_p_hoda_02",
      "pid": "p_hoda",
      "ago": 9.2,
      "temp": 36.8,
      "pain": 1,
      "nausea": 0,
      "fatigue": 1,
      "mood": 0,
      "note": "",
      "source": "form",
      "demo": true
    },
    "sy_p_hoda_03": {
      "id": "sy_p_hoda_03",
      "pid": "p_hoda",
      "ago": 6.2,
      "temp": 36.7,
      "pain": 0,
      "nausea": 0,
      "fatigue": 1,
      "mood": 0,
      "note": "",
      "source": "form",
      "demo": true
    },
    "sy_p_hoda_04": {
      "id": "sy_p_hoda_04",
      "pid": "p_hoda",
      "ago": 3.2,
      "temp": 36.8,
      "pain": 1,
      "nausea": 0,
      "fatigue": 1,
      "mood": 0,
      "note": "",
      "source": "form",
      "demo": true
    },
    "sy_p_hoda_05": {
      "id": "sy_p_hoda_05",
      "pid": "p_hoda",
      "ago": 0.4,
      "temp": 36.9,
      "pain": 0,
      "nausea": 0,
      "fatigue": 1,
      "mood": 0,
      "note": "",
      "source": "form",
      "demo": true
    },
    "sy_p_nadia_00": {
      "id": "sy_p_nadia_00",
      "pid": "p_nadia",
      "ago": 9.1,
      "temp": 36.7,
      "pain": 0,
      "nausea": 0,
      "fatigue": 0,
      "mood": 0,
      "note": "",
      "source": "form",
      "demo": true
    },
    "sy_p_nadia_01": {
      "id": "sy_p_nadia_01",
      "pid": "p_nadia",
      "ago": 2.1,
      "temp": 36.8,
      "pain": 1,
      "nausea": 0,
      "fatigue": 0,
      "mood": 0,
      "note": "",
      "source": "form",
      "demo": true
    }
  },
  "labs": {
    "lb_p_salma_0": {
      "id": "lb_p_salma_0",
      "pid": "p_salma",
      "ago": 70,
      "test": "CA 15-3",
      "value": 28.0,
      "unit": "U/mL",
      "ref": 30,
      "source": "manual",
      "demo": true
    },
    "lb_p_salma_1": {
      "id": "lb_p_salma_1",
      "pid": "p_salma",
      "ago": 42,
      "test": "CA 15-3",
      "value": 26.1,
      "unit": "U/mL",
      "ref": 30,
      "source": "manual",
      "demo": true
    },
    "lb_p_salma_2": {
      "id": "lb_p_salma_2",
      "pid": "p_salma",
      "ago": 20,
      "test": "CA 15-3",
      "value": 24.3,
      "unit": "U/mL",
      "ref": 30,
      "source": "manual",
      "demo": true
    },
    "lb_p_mona_0": {
      "id": "lb_p_mona_0",
      "pid": "p_mona",
      "ago": 120,
      "test": "CA 15-3",
      "value": 22.5,
      "unit": "U/mL",
      "ref": 30,
      "source": "manual",
      "demo": true
    },
    "lb_p_mona_1": {
      "id": "lb_p_mona_1",
      "pid": "p_mona",
      "ago": 60,
      "test": "CA 15-3",
      "value": 25.8,
      "unit": "U/mL",
      "ref": 30,
      "source": "manual",
      "demo": true
    },
    "lb_p_mona_2": {
      "id": "lb_p_mona_2",
      "pid": "p_mona",
      "ago": 0.5,
      "test": "CA 15-3",
      "value": 34.2,
      "unit": "U/mL",
      "ref": 30,
      "source": "manual",
      "demo": true
    },
    "lb_p_hoda_0": {
      "id": "lb_p_hoda_0",
      "pid": "p_hoda",
      "ago": 40,
      "test": "CA 15-3",
      "value": 18.4,
      "unit": "U/mL",
      "ref": 30,
      "source": "manual",
      "demo": true
    },
    "lb_p_hoda_1": {
      "id": "lb_p_hoda_1",
      "pid": "p_hoda",
      "ago": 15,
      "test": "CA 15-3",
      "value": 17.9,
      "unit": "U/mL",
      "ref": 30,
      "source": "manual",
      "demo": true
    },
    "lb_p_nadia_0": {
      "id": "lb_p_nadia_0",
      "pid": "p_nadia",
      "ago": 360,
      "test": "CA 15-3",
      "value": 14.2,
      "unit": "U/mL",
      "ref": 30,
      "source": "manual",
      "demo": true
    },
    "lb_p_nadia_1": {
      "id": "lb_p_nadia_1",
      "pid": "p_nadia",
      "ago": 180,
      "test": "CA 15-3",
      "value": 15.0,
      "unit": "U/mL",
      "ref": 30,
      "source": "manual",
      "demo": true
    }
  },
  "notes": {
    "nt_salma_1": {
      "id": "nt_salma_1",
      "pid": "p_salma",
      "ago": 19,
      "text": "بعد الجلسة التانية: غثيان متوسط أول يومين. كمّلي مضاد القيء زي ما هو مكتوب، واشربي سوايل كتير، وقيسي الحرارة كل يوم.",
      "by": "د. سارة عادل",
      "demo": true
    },
    "nt_nadia_1": {
      "id": "nt_nadia_1",
      "pid": "p_nadia",
      "ago": 175,
      "text": "المتابعة مستقرة والتحاليل كويسة. الميعاد الجاي بعد 6 شهور ومعاه ماموجرام.",
      "by": "د. سارة عادل",
      "demo": true
    }
  },
  "access": {
    "ac_salma_1": {
      "id": "ac_salma_1",
      "pid": "p_salma",
      "ago": 19,
      "who": "د. سارة عادل",
      "demo": true
    },
    "ac_hoda_1": {
      "id": "ac_hoda_1",
      "pid": "p_hoda",
      "ago": 2.9,
      "who": "د. سارة عادل",
      "demo": true
    }
  },
  "alerts": {
    "al_salma_1": {
      "id": "al_salma_1",
      "pid": "p_salma",
      "ago": 1.2,
      "severity": "red",
      "kind": "fever",
      "text": "حرارة 38.2",
      "status": "open",
      "demo": true
    },
    "al_mona_1": {
      "id": "al_mona_1",
      "pid": "p_mona",
      "ago": 0.5,
      "severity": "yellow",
      "kind": "lab",
      "text": "CA 15-3 34.2 أعلى من المرجعي (30)",
      "status": "open",
      "demo": true
    }
  },
  "medlogs": {}
}
