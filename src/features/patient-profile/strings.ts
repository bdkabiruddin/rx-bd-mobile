// Patient profile / allergies / contacts / privacy — feature-local
// bilingual strings ({ en, bn }). One language renders at a time (Wave 59
// rule); never both side by side. DSAR copy is deliberately honest about
// what each action does and its irreversibility.

import type { Localized } from '@/i18n/types';

export const PROFILE_STR = {
  // ── Summary (index) ──
  profileTitle: { en: 'My profile', bn: 'আমার প্রোফাইল' },
  editProfile: { en: 'Edit profile', bn: 'প্রোফাইল সম্পাদনা করুন' },
  allergiesLink: { en: 'My allergies', bn: 'আমার অ্যালার্জি' },
  privacyLink: { en: 'Privacy & data rights', bn: 'গোপনীয়তা ও ডেটা অধিকার' },
  birthDate: { en: 'Date of birth', bn: 'জন্ম তারিখ' },
  gender: { en: 'Gender', bn: 'লিঙ্গ' },
  bloodGroup: { en: 'Blood group', bn: 'রক্তের গ্রুপ' },
  height: { en: 'Height', bn: 'উচ্চতা' },
  heightCmUnit: { en: 'cm', bn: 'সেমি' },
  nationalId: { en: 'National ID (NID)', bn: 'জাতীয় পরিচয়পত্র (NID)' },
  birthRegNo: { en: 'Birth registration no.', bn: 'জন্ম নিবন্ধন নম্বর' },
  healthId: { en: 'Health ID', bn: 'হেলথ আইডি' },
  lactation: { en: 'Breastfeeding status', bn: 'স্তন্যদানের অবস্থা' },
  notSet: { en: 'Not set', bn: 'দেওয়া নেই' },
  noProfileYet: { en: 'No profile yet', bn: 'এখনো প্রোফাইল তৈরি হয়নি' },
  noProfileHint: {
    en: 'Add your birth date, blood group and identifiers so your care team has the basics.',
    bn: 'জন্ম তারিখ, রক্তের গ্রুপ ও পরিচয় নম্বর যোগ করুন, যাতে আপনার চিকিৎসা দল প্রয়োজনীয় তথ্য হাতে পায়।',
  },
  maskedHint: {
    en: 'Identifiers are shown partially hidden for your privacy.',
    bn: 'গোপনীয়তার স্বার্থে পরিচয় নম্বরগুলো আংশিক লুকানো অবস্থায় দেখানো হয়।',
  },

  // ── Gender / lactation labels ──
  genderMale: { en: 'Male', bn: 'পুরুষ' },
  genderFemale: { en: 'Female', bn: 'নারী' },
  genderOther: { en: 'Other', bn: 'অন্যান্য' },
  genderUnknown: { en: 'Prefer not to say', bn: 'বলতে চাই না' },
  lactating: { en: 'Currently breastfeeding', bn: 'বর্তমানে স্তন্যদান করছি' },
  notLactating: { en: 'Not breastfeeding', bn: 'স্তন্যদান করছি না' },
  lactationUnknown: { en: 'Not specified', bn: 'উল্লেখ নেই' },
  bloodUnknown: { en: 'Unknown', bn: 'অজানা' },

  // ── Edit form ──
  editTitle: { en: 'Edit profile', bn: 'প্রোফাইল সম্পাদনা' },
  birthDateLabel: { en: 'Date of birth (YYYY-MM-DD)', bn: 'জন্ম তারিখ (YYYY-MM-DD)' },
  heightLabel: { en: 'Height in cm (optional)', bn: 'উচ্চতা, সেমি-তে (ঐচ্ছিক)' },
  nidLabel: { en: 'National ID — 10, 13 or 17 digits (optional)', bn: 'জাতীয় পরিচয়পত্র — ১০, ১৩ বা ১৭ সংখ্যা (ঐচ্ছিক)' },
  brnLabel: { en: 'Birth registration no. — 17 digits (optional)', bn: 'জন্ম নিবন্ধন নম্বর — ১৭ সংখ্যা (ঐচ্ছিক)' },
  healthIdLabel: { en: 'Health ID (optional)', bn: 'হেলথ আইডি (ঐচ্ছিক)' },
  clearFieldHint: {
    en: 'Leave a field empty to remove its saved value.',
    bn: 'সংরক্ষিত কোনো তথ্য মুছতে ঘরটি খালি রেখে দিন।',
  },
  saveProfile: { en: 'Save profile', bn: 'প্রোফাইল সংরক্ষণ করুন' },
  profileSaved: { en: 'Profile saved', bn: 'প্রোফাইল সংরক্ষিত হয়েছে' },
  birthDateInvalid: { en: 'Enter a valid date as YYYY-MM-DD', bn: 'YYYY-MM-DD আকারে সঠিক তারিখ দিন' },
  birthDateFuture: { en: 'Birth date cannot be in the future', bn: 'জন্ম তারিখ ভবিষ্যতের হতে পারে না' },
  heightInvalid: { en: 'Height must be a number between 1 and 300', bn: 'উচ্চতা ১ থেকে ৩০০-এর মধ্যে একটি সংখ্যা হতে হবে' },
  nidInvalid: { en: 'NID must be 10, 13 or 17 digits', bn: 'NID অবশ্যই ১০, ১৩ বা ১৭ সংখ্যার হতে হবে' },
  brnInvalid: { en: 'Birth registration number must be exactly 17 digits', bn: 'জন্ম নিবন্ধন নম্বর অবশ্যই ঠিক ১৭ সংখ্যার হতে হবে' },
  healthIdInvalid: { en: 'Health ID must be 4–32 letters or digits', bn: 'হেলথ আইডি ৪–৩২টি অক্ষর বা সংখ্যার হতে হবে' },
  duplicateTitle: { en: 'Possible duplicate record', bn: 'সম্ভাব্য ডুপ্লিকেট রেকর্ড' },
  duplicateBody: {
    en: 'Your profile was saved. The identifier you added matches another record at this facility, so staff will review and link the records if needed. No action is needed from you.',
    bn: 'আপনার প্রোফাইল সংরক্ষিত হয়েছে। আপনার দেওয়া পরিচয় নম্বরটি এই প্রতিষ্ঠানের আরেকটি রেকর্ডের সাথে মিলে গেছে, তাই কর্তৃপক্ষ পর্যালোচনা করে প্রয়োজনে রেকর্ড দুটি যুক্ত করবে। আপনার কিছু করার দরকার নেই।',
  },

  // ── Emergency contacts ──
  contactsTitle: { en: 'Emergency contacts', bn: 'জরুরি যোগাযোগ' },
  addContact: { en: 'Add contact', bn: 'যোগাযোগ যোগ করুন' },
  noContacts: { en: 'No emergency contacts', bn: 'কোনো জরুরি যোগাযোগ নেই' },
  noContactsHint: {
    en: 'Add someone we can reach in an emergency.',
    bn: 'জরুরি অবস্থায় যোগাযোগ করা যাবে এমন কাউকে যোগ করুন।',
  },
  contactName: { en: 'Name', bn: 'নাম' },
  relationship: { en: 'Relationship', bn: 'সম্পর্ক' },
  relationshipHint: { en: 'e.g. spouse, parent, sibling', bn: 'যেমন: স্বামী/স্ত্রী, বাবা-মা, ভাই-বোন' },
  contactPhone: { en: 'Mobile number', bn: 'মোবাইল নম্বর' },
  contactPhoneHint: { en: 'Bangladeshi mobile, e.g. 01712345678', bn: 'বাংলাদেশি মোবাইল, যেমন: 01712345678' },
  contactEmail: { en: 'Email (optional)', bn: 'ইমেইল (ঐচ্ছিক)' },
  contactNotes: { en: 'Notes (optional)', bn: 'নোট (ঐচ্ছিক)' },
  saveContact: { en: 'Save contact', bn: 'যোগাযোগ সংরক্ষণ করুন' },
  contactSaved: { en: 'Contact saved', bn: 'যোগাযোগ সংরক্ষিত হয়েছে' },
  removeContact: { en: 'Remove', bn: 'মুছে ফেলুন' },
  removeContactTitle: { en: 'Remove this contact?', bn: 'এই যোগাযোগ মুছে ফেলবেন?' },
  removeContactBody: {
    en: 'This person will no longer be contacted in an emergency.',
    bn: 'জরুরি অবস্থায় এই ব্যক্তির সাথে আর যোগাযোগ করা হবে না।',
  },
  keep: { en: 'Keep', bn: 'রাখুন' },
  nameRequired: { en: 'Name is required', bn: 'নাম আবশ্যক' },
  relationshipRequired: { en: 'Relationship is required', bn: 'সম্পর্ক আবশ্যক' },
  phoneInvalid: { en: 'Enter a valid Bangladeshi mobile number', bn: 'সঠিক বাংলাদেশি মোবাইল নম্বর দিন' },
  emailInvalid: { en: 'Enter a valid email address', bn: 'সঠিক ইমেইল ঠিকানা দিন' },

  // ── Allergies ──
  allergiesTitle: { en: 'My allergies', bn: 'আমার অ্যালার্জি' },
  allergiesSafetyNote: {
    en: 'Doctors and pharmacists check this list before prescribing or dispensing. Keep it accurate.',
    bn: 'প্রেসক্রিপশন লেখা বা ওষুধ দেওয়ার আগে ডাক্তার ও ফার্মাসিস্ট এই তালিকা দেখেন। তালিকাটি সঠিক রাখুন।',
  },
  activeAllergies: { en: 'Active', bn: 'সক্রিয়' },
  resolvedAllergies: { en: 'Resolved', bn: 'নিরাময় হয়েছে' },
  noAllergies: { en: 'No allergies recorded', bn: 'কোনো অ্যালার্জি নথিভুক্ত নেই' },
  noAllergiesHint: {
    en: 'If you have a known allergy, add it — it protects you when medicines are prescribed.',
    bn: 'আপনার জানা কোনো অ্যালার্জি থাকলে যোগ করুন — ওষুধ লেখার সময় এটি আপনাকে সুরক্ষা দেবে।',
  },
  addAllergy: { en: 'Add allergy', bn: 'অ্যালার্জি যোগ করুন' },
  allergenLabel: { en: 'Allergen', bn: 'অ্যালার্জেন' },
  allergenHint: { en: 'e.g. penicillin, peanuts, dust', bn: 'যেমন: পেনিসিলিন, চিনাবাদাম, ধুলা' },
  severityLabel: { en: 'Severity', bn: 'তীব্রতা' },
  sevMild: { en: 'Mild', bn: 'মৃদু' },
  sevModerate: { en: 'Moderate', bn: 'মাঝারি' },
  sevSevere: { en: 'Severe', bn: 'তীব্র' },
  sevAnaphylaxis: { en: 'Anaphylaxis', bn: 'অ্যানাফিল্যাক্সিস' },
  reactionLabel: { en: 'Reaction (optional)', bn: 'প্রতিক্রিয়া (ঐচ্ছিক)' },
  reactionHint: { en: 'e.g. rash, swelling, breathing trouble', bn: 'যেমন: র‍্যাশ, ফোলা, শ্বাসকষ্ট' },
  onsetLabel: { en: 'First noticed (YYYY-MM-DD, optional)', bn: 'প্রথম দেখা দেয় (YYYY-MM-DD, ঐচ্ছিক)' },
  saveAllergy: { en: 'Save allergy', bn: 'অ্যালার্জি সংরক্ষণ করুন' },
  allergySaved: { en: 'Allergy recorded', bn: 'অ্যালার্জি নথিভুক্ত হয়েছে' },
  markResolved: { en: 'Mark resolved', bn: 'নিরাময় হয়েছে চিহ্নিত করুন' },
  resolveTitle: { en: 'Mark this allergy as resolved?', bn: 'এই অ্যালার্জি নিরাময় হয়েছে বলে চিহ্নিত করবেন?' },
  resolveBody: {
    en: 'It will no longer warn your care team, but it stays in your record. Only do this if a clinician has confirmed the allergy is gone.',
    bn: 'এরপর এটি আর আপনার চিকিৎসা দলকে সতর্ক করবে না, তবে রেকর্ডে থেকে যাবে। চিকিৎসক নিশ্চিত করলে তবেই এটি করুন।',
  },
  allergenRequired: { en: 'Allergen is required', bn: 'অ্যালার্জেন লেখা আবশ্যক' },
  severityRequired: { en: 'Choose a severity', bn: 'তীব্রতা নির্বাচন করুন' },
  onsetInvalid: { en: 'Enter a valid past date as YYYY-MM-DD', bn: 'YYYY-MM-DD আকারে সঠিক অতীত তারিখ দিন' },
  recordedOn: { en: 'Recorded', bn: 'নথিভুক্ত' },

  // ── Privacy / DSAR ──
  privacyTitle: { en: 'Privacy & data rights', bn: 'গোপনীয়তা ও ডেটা অধিকার' },
  rightsIntro: {
    en: 'You can request a copy of your data, a machine-readable copy to take elsewhere, or permanent erasure. Every request is reviewed by an administrator before anything happens; you can cancel a request while it is still pending.',
    bn: 'আপনি আপনার ডেটার একটি কপি, অন্যত্র নেওয়ার জন্য মেশিন-পাঠযোগ্য কপি, অথবা স্থায়ীভাবে মুছে ফেলার অনুরোধ করতে পারেন। কোনো কিছু ঘটার আগে প্রতিটি অনুরোধ একজন প্রশাসক পর্যালোচনা করেন; অনুরোধ অপেক্ষমাণ থাকা অবস্থায় আপনি তা বাতিল করতে পারবেন।',
  },
  requestExport: { en: 'Request a copy of my data', bn: 'আমার ডেটার কপি চাই' },
  exportConfirmTitle: { en: 'Request a data export?', bn: 'ডেটা এক্সপোর্টের অনুরোধ করবেন?' },
  exportConfirmBody: {
    en: 'This files a request for a downloadable copy of the data held about you. An administrator reviews it first; preparing the copy can take some time.',
    bn: 'এটি আপনার সম্পর্কে সংরক্ষিত ডেটার একটি ডাউনলোডযোগ্য কপির অনুরোধ জমা দেবে। প্রথমে একজন প্রশাসক তা পর্যালোচনা করবেন; কপি তৈরি হতে কিছু সময় লাগতে পারে।',
  },
  requestPortability: { en: 'Request portable data (FHIR)', bn: 'স্থানান্তরযোগ্য ডেটা চাই (FHIR)' },
  portabilityConfirmTitle: { en: 'Request portable data?', bn: 'স্থানান্তরযোগ্য ডেটার অনুরোধ করবেন?' },
  portabilityConfirmBody: {
    en: 'This files a request for your data in a machine-readable medical format (FHIR) that another provider can import. An administrator reviews it first.',
    bn: 'এটি মেশিন-পাঠযোগ্য চিকিৎসা ফরম্যাটে (FHIR) আপনার ডেটার অনুরোধ জমা দেবে, যা অন্য কোনো সেবাদাতা আমদানি করতে পারবে। প্রথমে একজন প্রশাসক তা পর্যালোচনা করবেন।',
  },
  requestErasure: { en: 'Request erasure of my data', bn: 'আমার ডেটা মুছে ফেলার অনুরোধ' },
  erasureConfirmTitle: { en: 'Permanently erase your data?', bn: 'আপনার ডেটা স্থায়ীভাবে মুছে ফেলবেন?' },
  erasureWarning: {
    en: 'This cannot be undone. After review and approval, your personal data will be permanently anonymized and you will lose access to your history in this app. Records the law requires to be kept (for example certain medical and audit records) are retained in anonymized or legally mandated form.',
    bn: 'এটি আর ফেরানো যাবে না। পর্যালোচনা ও অনুমোদনের পর আপনার ব্যক্তিগত ডেটা স্থায়ীভাবে বেনামি করা হবে এবং এই অ্যাপে আপনার ইতিহাস আর দেখতে পারবেন না। আইন অনুযায়ী যে রেকর্ড রাখা বাধ্যতামূলক (যেমন কিছু চিকিৎসা ও নিরীক্ষা রেকর্ড), সেগুলো বেনামি বা আইনসম্মত রূপে সংরক্ষিত থাকবে।',
  },
  erasureConfirmAction: { en: 'Request erasure', bn: 'মুছে ফেলার অনুরোধ করুন' },
  submitRequest: { en: 'Submit request', bn: 'অনুরোধ জমা দিন' },
  requestSubmitted: { en: 'Request submitted', bn: 'অনুরোধ জমা হয়েছে' },
  requestSubmittedBody: {
    en: 'An administrator will review it. You can track its status below.',
    bn: 'একজন প্রশাসক এটি পর্যালোচনা করবেন। নিচে এর অবস্থা দেখতে পারবেন।',
  },
  myRequests: { en: 'My requests', bn: 'আমার অনুরোধসমূহ' },
  noRequests: { en: 'No requests yet', bn: 'এখনো কোনো অনুরোধ নেই' },
  cancelRequest: { en: 'Cancel request', bn: 'অনুরোধ বাতিল করুন' },
  cancelRequestTitle: { en: 'Cancel this request?', bn: 'এই অনুরোধ বাতিল করবেন?' },
  cancelRequestBody: {
    en: 'This withdraws the request before review. Only pending requests can be cancelled.',
    bn: 'এটি পর্যালোচনার আগেই অনুরোধটি প্রত্যাহার করবে। শুধুমাত্র অপেক্ষমাণ অনুরোধ বাতিল করা যায়।',
  },
  requestCancelled: { en: 'Request cancelled', bn: 'অনুরোধ বাতিল হয়েছে' },
  typeExport: { en: 'Data export', bn: 'ডেটা এক্সপোর্ট' },
  typePortability: { en: 'Portability (FHIR)', bn: 'পোর্টেবিলিটি (FHIR)' },
  typeErasure: { en: 'Erasure', bn: 'ডেটা মুছে ফেলা' },
  statusPending: { en: 'Pending review', bn: 'পর্যালোচনার অপেক্ষায়' },
  statusApproved: { en: 'Approved', bn: 'অনুমোদিত' },
  statusRejected: { en: 'Rejected', bn: 'প্রত্যাখ্যাত' },
  statusCancelled: { en: 'Cancelled', bn: 'বাতিল' },
  statusInProgress: { en: 'In progress', bn: 'চলমান' },
  statusCompleted: { en: 'Completed', bn: 'সম্পন্ন' },
  statusExpired: { en: 'Expired', bn: 'মেয়াদোত্তীর্ণ' },
  downloadExport: { en: 'Download export', bn: 'এক্সপোর্ট ডাউনলোড করুন' },
  submitted: { en: 'Submitted', bn: 'জমা দেওয়া হয়েছে' },
  dueBy: { en: 'Due by', bn: 'নিষ্পত্তির শেষ তারিখ' },
  rejectionReason: { en: 'Reason', bn: 'কারণ' },

  // ── Access log ──
  accessLogTitle: { en: 'My access log', bn: 'আমার অ্যাক্সেস লগ' },
  accessLogDesc: {
    en: 'Every recorded action on your account and records — including this view itself.',
    bn: 'আপনার অ্যাকাউন্ট ও রেকর্ডে নথিভুক্ত প্রতিটি কার্যক্রম — এমনকি এই দেখাটিও।',
  },
  showAccessLog: { en: 'Show access log', bn: 'অ্যাক্সেস লগ দেখুন' },
  hideAccessLog: { en: 'Hide access log', bn: 'অ্যাক্সেস লগ লুকান' },
  noAccessLog: { en: 'No entries yet', bn: 'এখনো কোনো এন্ট্রি নেই' },
  accessLogShowing: { en: 'Latest', bn: 'সর্বশেষ' },
  accessLogOf: { en: 'of', bn: 'এর মধ্যে' },

  // ── Shared ──
  back: { en: 'Back', bn: 'ফিরে যান' },
  offlineWrite: {
    en: 'You are offline. Reconnect to make changes.',
    bn: 'আপনি অফলাইনে আছেন। পরিবর্তন করতে আবার সংযুক্ত হোন।',
  },
} satisfies Record<string, Localized>;

// ── Label helpers (raw enum → Localized; fall back honestly to the raw
//    value rather than fabricating a translation) ─────────────────────────

export function genderLabel(gender: string): Localized {
  switch (gender) {
    case 'male':
      return PROFILE_STR.genderMale;
    case 'female':
      return PROFILE_STR.genderFemale;
    case 'other':
      return PROFILE_STR.genderOther;
    case 'unknown':
      return PROFILE_STR.genderUnknown;
    default:
      return { en: gender, bn: gender };
  }
}

export function lactationLabel(status: string): Localized {
  switch (status) {
    case 'LACTATING':
      return PROFILE_STR.lactating;
    case 'NOT_LACTATING':
      return PROFILE_STR.notLactating;
    case 'UNKNOWN':
      return PROFILE_STR.lactationUnknown;
    default:
      return { en: status, bn: status };
  }
}

export function severityLabel(severity: string): Localized {
  switch (severity) {
    case 'MILD':
      return PROFILE_STR.sevMild;
    case 'MODERATE':
      return PROFILE_STR.sevModerate;
    case 'SEVERE':
      return PROFILE_STR.sevSevere;
    case 'ANAPHYLAXIS':
      return PROFILE_STR.sevAnaphylaxis;
    default:
      return { en: severity, bn: severity };
  }
}

export function dsarTypeLabel(type: string): Localized {
  switch (type) {
    case 'EXPORT':
      return PROFILE_STR.typeExport;
    case 'PORTABILITY':
      return PROFILE_STR.typePortability;
    case 'ERASURE':
      return PROFILE_STR.typeErasure;
    default:
      return { en: type, bn: type };
  }
}

export function dsarStatusLabel(status: string): Localized {
  switch (status) {
    case 'PENDING':
      return PROFILE_STR.statusPending;
    case 'APPROVED':
      return PROFILE_STR.statusApproved;
    case 'REJECTED':
      return PROFILE_STR.statusRejected;
    case 'CANCELLED':
      return PROFILE_STR.statusCancelled;
    case 'IN_PROGRESS':
      return PROFILE_STR.statusInProgress;
    case 'COMPLETED':
      return PROFILE_STR.statusCompleted;
    case 'EXPIRED':
      return PROFILE_STR.statusExpired;
    default:
      return { en: status, bn: status };
  }
}
