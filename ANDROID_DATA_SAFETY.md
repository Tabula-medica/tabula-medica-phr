# Tabula Medica — Google Play Data Safety Section
# Fill this into the Play Console under App content > Data safety
# Last updated: March 2026

## Does your app collect or share any of the required data types?
Answer: YES

## Is all of the user data collected by your app encrypted in transit?
Answer: YES (TLS 1.3 enforced, cleartext blocked via network_security_config.xml)

## Do you provide a way for users to request data deletion?
Answer: YES — Settings > Privacy > Delete My Account & Data
Deletion URL: https://app.tabulamedica.health/delete-account

---

## DATA TYPES TO DECLARE

### Health & Fitness
| Data type           | Collected | Shared | Required | Ephemeral | User can delete |
|---------------------|-----------|--------|----------|-----------|-----------------|
| Health info         | YES       | NO     | YES      | NO        | YES             |
| Fitness info        | YES       | NO     | NO       | NO        | YES             |
| Medical info        | YES       | NO     | YES      | NO        | YES             |

**Purpose:** App functionality (core unified health record feature)
**Processing note:** Health data is not used for advertising or shared with third parties without explicit user consent.

### Personal info
| Data type           | Collected | Shared | Required | Ephemeral | User can delete |
|---------------------|-----------|--------|----------|-----------|-----------------|
| Name                | YES       | NO     | YES      | NO        | YES             |
| Email address       | YES       | NO     | YES      | NO        | YES             |
| User IDs            | YES       | NO     | YES      | NO        | YES             |
| Phone number        | NO        | NO     | —        | —         | —               |
| Address             | NO        | NO     | —        | —         | —               |

**Purpose:** App functionality, Account management

### Financial info
| Data type           | Collected | Shared |
|---------------------|-----------|--------|
| Payment info        | NO        | NO     |
| Purchase history    | NO        | NO     |

### Location
| Data type           | Collected | Shared | Required | Ephemeral | User can delete |
|---------------------|-----------|--------|----------|-----------|-----------------|
| Precise location    | YES       | NO     | NO       | YES       | YES             |
| Coarse location     | YES       | NO     | NO       | YES       | YES             |

**Purpose:** App functionality (find nearby providers/pharmacies)
**Note:** Location is only accessed when user explicitly uses provider finder. Not stored long-term.

### App activity
| Data type           | Collected | Shared |
|---------------------|-----------|--------|
| App interactions    | YES       | NO     |
| In-app search history | YES    | NO     |
| Installed apps      | NO        | NO     |
| Other user-generated content | YES | NO |

**Purpose:** App functionality, Analytics (internal only, not shared with third parties)

### Audio (SENSITIVE)
| Data type           | Collected | Shared | Required | Ephemeral | User can delete |
|---------------------|-----------|--------|----------|-----------|-----------------|
| Voice/sound recordings | YES  | NO     | NO       | YES*      | YES             |

**Purpose:** App functionality (ambient encounter transcription — user must explicitly enable)
**Note*:** Audio is processed in real-time and not permanently stored. Transcripts are stored as text only, with user consent. Recordings are deleted after transcription.

### Photos and videos
| Data type           | Collected | Shared |
|---------------------|-----------|--------|
| Photos              | YES       | NO     |
| Videos              | NO        | NO     |

**Purpose:** App functionality (OCR scanning of medical documents)
**Note:** Photos are processed locally for OCR and not stored as images on our servers.

---

## SENSITIVE PERMISSIONS RATIONALE (for Play Console review)

### RECORD_AUDIO
**Rationale:** Tabula Medica includes an optional Ambient Encounter Assistant that transcribes 
medical appointments to help patients remember provider instructions, medication changes, and 
follow-up actions. Microphone access is only activated when the user explicitly starts a 
session by tapping "Start Listening." A visible recording indicator is displayed at all times 
during active recording. Users must grant explicit consent before this feature is available. 
Audio is processed by Google Cloud Speech-to-Text and is not stored permanently.

### ACCESS_FINE_LOCATION
**Rationale:** Used only in the Provider & Pharmacy Finder feature to show nearby healthcare 
providers and pharmacies. Location is never stored server-side and is only accessed when the 
user explicitly opens this feature.

### READ_CONTACTS
**Rationale:** Used only to let users add emergency contacts to their health profile for 
caregiver sharing. Contact data is never uploaded to our servers; it is read locally to 
pre-fill the contact name/phone field.

### READ_MEDIA_IMAGES
**Rationale:** Used to allow users to select photos of medical documents (lab results, 
prescription labels, insurance cards) for OCR extraction into their health record.

### FOREGROUND_SERVICE + FOREGROUND_SERVICE_MICROPHONE
**Rationale:** Required by Android 14+ for apps using the microphone in a foreground service. 
The ambient encounter transcription feature uses a foreground service so users can navigate 
the app while transcription continues, with a persistent notification showing the active status.

### POST_NOTIFICATIONS
**Rationale:** Used to send reminders about medications, upcoming appointments, and follow-up 
actions extracted from ambient encounter sessions. Users can configure or disable all 
notification categories in Settings > Notifications.

---

## HEALTH CONNECT INTEGRATION (if adding in future)
If you add Health Connect integration, you will also need to:
1. Add `<uses-permission android:name="android.permission.health.READ_STEPS"/>` etc.
2. Add the Health Connect privacy policy URL to Play Console
3. Add a Health Connect section to your in-app privacy policy
4. Pass the Health Connect permissions review (separate from standard Play review)
Health Connect policy: https://developer.android.com/health-and-fitness/guides/health-connect/publish/policy

---

## INDEPENDENT SECURITY REVIEW
Google Play requires apps in the "Health" category to complete a security assessment 
if they handle sensitive health data. Tabula Medica qualifies.
Required: App Defense Alliance (ADA) MASA assessment or equivalent
Timeline: Allow 4-6 weeks before submission
More info: https://developers.google.com/android/play-protect/cloud-apps-assessment
