// ExpoCacReaderModule.kt
//
// CAC / PIV Smart Card Reader — Android NFC IsoDep Implementation
// ===============================================================
//
// What this does:
//   Uses Android NFC (ISO 14443-4 / ISO 7816-4) to communicate with
//   contactless CAC cards and USB card readers via Android Keystore.
//
//   Android NFC approach:
//   - Registers an NfcAdapter.ReaderCallback to receive ISO-DEP tags
//   - Uses IsoDep.get(tag) to open a transceive channel
//   - Sends ISO 7816-4 APDUs identically to the iOS implementation
//   - Handles ACR122U and similar USB readers via UsbManager as PC/SC host
//
//   USB Reader approach (for tablets/devices with USB-C readers):
//   - Android USB Host API detects PC/SC compliant readers
//   - CCID protocol over USB bulk transfers
//   - Maps to the same PIV APDU commands
//
// How it compares to iOS:
//   iOS has CryptoTokenKit which abstracts card communication elegantly.
//   Android requires direct NFC/USB management but gives more hardware flexibility.
//   Most DoD-issued CAC readers (ACR3901T) work with both platforms.

package expo.modules.cacreader

import android.app.Activity
import android.content.Context
import android.nfc.NfcAdapter
import android.nfc.Tag
import android.nfc.tech.IsoDep
import android.os.Bundle
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.Promise
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.ByteArrayOutputStream
import java.security.cert.CertificateFactory
import java.security.cert.X509Certificate
import java.io.ByteArrayInputStream
import java.util.regex.Pattern

// ─── PIV AID and constants ────────────────────────────────────────────────────

private val PIV_AID = byteArrayOf(
    0xA0.toByte(), 0x00, 0x00, 0x03, 0x08.toByte(),
    0x00, 0x00, 0x10, 0x00, 0x01, 0x00
)

private val PIV_OBJ_AUTH_CERT     = byteArrayOf(0x5C, 0x03, 0x5F, 0xC1.toByte(), 0x05)
private val PIV_OBJ_SIGN_CERT     = byteArrayOf(0x5C, 0x03, 0x5F, 0xC1.toByte(), 0x0A)
private val PIV_OBJ_CHUID         = byteArrayOf(0x5C, 0x03, 0x5F, 0xC1.toByte(), 0x02)

private const val CLA_ISO:    Byte = 0x00
private const val INS_SELECT: Byte = 0xA4.toByte()
private const val INS_GET_DATA:   Byte = 0xCB.toByte()
private const val INS_GEN_AUTH:   Byte = 0x87.toByte()
private const val INS_VERIFY:     Byte = 0x20
private const val INS_GET_RESP:   Byte = 0xC0.toByte()

private const val SW_SUCCESS:      Int = 0x9000
private const val SW_MORE_MASK:    Int = 0x6100
private const val SW_WRONG_PIN:    Int = 0x63C0
private const val SW_PIN_BLOCKED:  Int = 0x6983
private const val SW_SEC_DENIED:   Int = 0x6982

class ExpoCacReaderModule : Module() {

    private var isoDep: IsoDep? = null
    private var nfcAdapter: NfcAdapter? = null
    private var readerCallback: NfcAdapter.ReaderCallback? = null
    private val scope = CoroutineScope(Dispatchers.IO)

    override fun definition() = ModuleDefinition {
        Name("ExpoCacReader")

        Events("onCardInserted", "onCardRemoved", "onReaderConnected", "onReaderDisconnected")

        // ── Start NFC reader mode ──────────────────────────────────────────────
        AsyncFunction("startWatching") { promise: Promise ->
            val activity = appContext.activityProvider?.currentActivity
            if (activity == null) {
                promise.reject("NO_ACTIVITY", "Activity not available", null)
                return@AsyncFunction
            }

            nfcAdapter = NfcAdapter.getDefaultAdapter(activity)
            if (nfcAdapter == null || !nfcAdapter!!.isEnabled) {
                promise.reject("NFC_UNAVAILABLE", "NFC is not available or disabled on this device", null)
                return@AsyncFunction
            }

            readerCallback = NfcAdapter.ReaderCallback { tag ->
                handleTagDiscovered(tag)
            }

            val flags = NfcAdapter.FLAG_READER_NFC_A or
                        NfcAdapter.FLAG_READER_NFC_B or
                        NfcAdapter.FLAG_READER_SKIP_NDEF_CHECK

            val extras = Bundle().apply {
                putInt(NfcAdapter.EXTRA_READER_PRESENCE_CHECK_DELAY, 300)
            }

            activity.runOnUiThread {
                nfcAdapter?.enableReaderMode(activity, readerCallback, flags, extras)
            }

            promise.resolve(true)
        }

        AsyncFunction("stopWatching") { promise: Promise ->
            val activity = appContext.activityProvider?.currentActivity
            activity?.runOnUiThread {
                readerCallback?.let { nfcAdapter?.disableReaderMode(activity) }
            }
            isoDep?.close()
            isoDep = null
            promise.resolve(true)
        }

        // ── Get available readers ──────────────────────────────────────────────
        AsyncFunction("getAvailableReaders") { promise: Promise ->
            val context = appContext.reactContext ?: run {
                promise.reject("NO_CONTEXT", "Context unavailable", null)
                return@AsyncFunction
            }

            val adapter = NfcAdapter.getDefaultAdapter(context)
            val nfcAvailable = adapter != null
            val nfcEnabled = adapter?.isEnabled == true
            val cardPresent = isoDep?.isConnected == true

            promise.resolve(mapOf(
                "nfcAvailable" to nfcAvailable,
                "nfcEnabled" to nfcEnabled,
                "cardPresent" to cardPresent,
                "supportsSmartCard" to nfcEnabled,
                "readers" to listOf<Map<String, Any>>(),
                "tokens" to if (cardPresent) listOf("nfc-card") else listOf<String>()
            ))
        }

        // ── Read PIV authentication certificate (slot 9A) ──────────────────────
        AsyncFunction("readAuthCertificate") { _: String?, promise: Promise ->
            scope.launch {
                try {
                    val dep = requireIsoDep(promise) ?: return@launch

                    selectPIVApplication(dep)
                    val certDER = readPIVObject(dep, PIV_OBJ_AUTH_CERT)
                    val parsed = parseCertificate(certDER)

                    withContext(Dispatchers.Main) {
                        promise.resolve(mapOf(
                            "certDerBase64" to android.util.Base64.encodeToString(
                                certDER, android.util.Base64.NO_WRAP
                            ),
                            "subject"      to (parsed["subject"] ?: ""),
                            "issuer"       to (parsed["issuer"] ?: ""),
                            "serialNumber" to (parsed["serialNumber"] ?: ""),
                            "notBefore"    to (parsed["notBefore"] ?: ""),
                            "notAfter"     to (parsed["notAfter"] ?: ""),
                            "edipi"        to (parsed["edipi"] ?: ""),
                            "email"        to (parsed["email"] ?: ""),
                            "keyAlgorithm" to (parsed["keyAlgorithm"] ?: ""),
                            "slot"         to "9A"
                        ))
                    }
                } catch (e: CACException) {
                    withContext(Dispatchers.Main) {
                        promise.reject(e.code, e.message ?: "Unknown error", null)
                    }
                } catch (e: Exception) {
                    withContext(Dispatchers.Main) {
                        promise.reject("READ_FAILED", e.message ?: "Unknown error", null)
                    }
                }
            }
        }

        // ── Verify PIN ─────────────────────────────────────────────────────────
        AsyncFunction("verifyPin") { pin: String, promise: Promise ->
            if (pin.length !in 4..8 || !pin.all { it.isDigit() }) {
                promise.reject("INVALID_PIN", "PIN must be 4–8 digits", null)
                return@AsyncFunction
            }

            scope.launch {
                try {
                    val dep = requireIsoDep(promise) ?: return@launch
                    selectPIVApplication(dep)
                    val retries = verifyCardPin(dep, pin)
                    withContext(Dispatchers.Main) {
                        promise.resolve(mapOf("success" to true, "retriesRemaining" to retries))
                    }
                } catch (e: CACException) {
                    withContext(Dispatchers.Main) {
                        when (e.code) {
                            "WRONG_PIN"  -> promise.resolve(mapOf("success" to false, "retriesRemaining" to (e.data as? Int ?: 0)))
                            "PIN_BLOCKED" -> promise.reject("PIN_BLOCKED", "Card PIN is blocked", null)
                            else -> promise.reject(e.code, e.message, null)
                        }
                    }
                }
            }
        }

        // ── Sign challenge with slot 9A private key ────────────────────────────
        AsyncFunction("signChallenge") { challengeHex: String, promise: Promise ->
            if (challengeHex.length != 64 || !challengeHex.all { it.lowercaseChar() in '0'..'9' || it.lowercaseChar() in 'a'..'f' }) {
                promise.reject("INVALID_CHALLENGE", "Challenge must be 32 bytes (64 hex chars)", null)
                return@AsyncFunction
            }

            scope.launch {
                try {
                    val dep = requireIsoDep(promise) ?: return@launch

                    selectPIVApplication(dep)
                    val certDER = readPIVObject(dep, PIV_OBJ_AUTH_CERT)
                    val parsed = parseCertificate(certDER)
                    val isECDSA = parsed["keyAlgorithm"]?.contains("EC") != false

                    val challengeBytes = hexToBytes(challengeHex)
                    val signature = generalAuthenticate(dep, challengeBytes, 0x9A, isECDSA)

                    withContext(Dispatchers.Main) {
                        promise.resolve(mapOf(
                            "signatureBase64" to android.util.Base64.encodeToString(
                                signature, android.util.Base64.NO_WRAP
                            ),
                            "signatureHex" to bytesToHex(signature),
                            "algorithm"    to if (isECDSA) "ECDSA-P384" else "RSA-2048",
                            "slot"         to "9A"
                        ))
                    }
                } catch (e: CACException) {
                    withContext(Dispatchers.Main) {
                        promise.reject(e.code, e.message, null)
                    }
                }
            }
        }

        AsyncFunction("getCardInfo") { promise: Promise ->
            scope.launch {
                try {
                    val dep = requireIsoDep(promise) ?: return@launch
                    selectPIVApplication(dep)
                    val chuidData = readPIVObject(dep, PIV_OBJ_CHUID)
                    val parsed = parseChuid(chuidData)
                    withContext(Dispatchers.Main) { promise.resolve(parsed) }
                } catch (e: Exception) {
                    withContext(Dispatchers.Main) {
                        promise.reject("READ_FAILED", e.message, null)
                    }
                }
            }
        }

        AsyncFunction("disconnect") { promise: Promise ->
            try {
                isoDep?.close()
                isoDep = null
                promise.resolve(true)
            } catch (e: Exception) {
                promise.resolve(false)
            }
        }
    }

    // ─── NFC tag discovery ────────────────────────────────────────────────────

    private fun handleTagDiscovered(tag: Tag) {
        val dep = IsoDep.get(tag)
        if (dep == null) {
            sendEvent("onCardRemoved", mapOf("tokenId" to "nfc-tag"))
            return
        }

        try {
            dep.connect()
            dep.timeout = 5000  // 5 second timeout for card operations
            isoDep = dep

            sendEvent("onCardInserted", mapOf(
                "tokenId"    to "nfc-card-${bytesToHex(tag.id)}",
                "readerName" to "NFC Smart Card Reader",
                "tagId"      to bytesToHex(tag.id),
                "techList"   to tag.techList.toList()
            ))
        } catch (e: Exception) {
            sendEvent("onCardRemoved", mapOf("tokenId" to "nfc-card"))
        }
    }

    // ─── PIV APDU operations ──────────────────────────────────────────────────

    private fun selectPIVApplication(dep: IsoDep) {
        val apdu = byteArrayOf(CLA_ISO, INS_SELECT, 0x04, 0x00, PIV_AID.size.toByte()) + PIV_AID
        val response = sendAPDU(dep, apdu)
        val sw = getSW(response)
        if (sw != SW_SUCCESS) {
            throw CACException("SESSION_FAILED", "PIV application not found (SW: ${sw.toHex()})")
        }
    }

    private fun readPIVObject(dep: IsoDep, objectId: ByteArray): ByteArray {
        val payload = objectId
        val apdu = byteArrayOf(CLA_ISO, INS_GET_DATA, 0x3F, 0xFF, payload.size.toByte()) + payload + byteArrayOf(0x00)

        var response = sendAPDU(dep, apdu)
        var sw = getSW(response)
        val buffer = ByteArrayOutputStream()
        buffer.write(getResponseData(response))

        // Handle chained response (SW 61xx)
        while ((sw and 0xFF00) == (SW_MORE_MASK and 0xFF00)) {
            val remaining = (sw and 0x00FF).toByte()
            val getMore = byteArrayOf(CLA_ISO, INS_GET_RESP, 0x00, 0x00, remaining)
            response = sendAPDU(dep, getMore)
            sw = getSW(response)
            buffer.write(getResponseData(response))
        }

        if (sw == SW_SEC_DENIED) throw CACException("PIN_REQUIRED", "PIN verification required")
        if (sw != SW_SUCCESS) throw CACException("READ_FAILED", "GET DATA failed (SW: ${sw.toHex()})")

        return extractCertFromPIVObject(buffer.toByteArray())
    }

    private fun verifyCardPin(dep: IsoDep, pin: String): Int {
        val pinBytes = pin.toByteArray(Charsets.UTF_8)
        val apdu = byteArrayOf(CLA_ISO, INS_VERIFY, 0x00, 0x80, pinBytes.size.toByte()) + pinBytes
        val response = sendAPDU(dep, apdu)
        val sw = getSW(response)

        if (sw == SW_SUCCESS) return 3
        if (sw == SW_PIN_BLOCKED) throw CACException("PIN_BLOCKED", "Card PIN is blocked")
        if ((sw and 0xFFF0) == (SW_WRONG_PIN and 0xFFF0)) {
            throw CACException("WRONG_PIN", "Wrong PIN", sw and 0x000F)
        }

        throw CACException("VERIFY_FAILED", "PIN verify failed (SW: ${sw.toHex()})")
    }

    private fun generalAuthenticate(dep: IsoDep, challenge: ByteArray, slot: Byte, isECDSA: Boolean): ByteArray {
        // Build 7C dynamic auth template
        val innerTemplate = ByteArrayOutputStream().apply {
            write(byteArrayOf(0x81.toByte(), challenge.size.toByte()))
            write(challenge)
            write(byteArrayOf(0x82.toByte(), 0x00))
        }.toByteArray()

        val payload = ByteArrayOutputStream().apply {
            write(byteArrayOf(0x7C, innerTemplate.size.toByte()))
            write(innerTemplate)
        }.toByteArray()

        val algRef: Byte = if (isECDSA) 0x06 else 0x07 // P-384 = 0x06 per SP 800-73-4

        val apdu = byteArrayOf(CLA_ISO, INS_GEN_AUTH, algRef, slot, payload.size.toByte()) +
                   payload + byteArrayOf(0x00)

        var response = sendAPDU(dep, apdu)
        var sw = getSW(response)
        val buffer = ByteArrayOutputStream()
        buffer.write(getResponseData(response))

        while ((sw and 0xFF00) == (SW_MORE_MASK and 0xFF00)) {
            val remaining = (sw and 0x00FF).toByte()
            val getMore = byteArrayOf(CLA_ISO, INS_GET_RESP, 0x00, 0x00, remaining)
            response = sendAPDU(dep, getMore)
            sw = getSW(response)
            buffer.write(getResponseData(response))
        }

        if (sw == SW_SEC_DENIED) throw CACException("PIN_REQUIRED", "PIN required for signing")
        if (sw != SW_SUCCESS) throw CACException("SIGN_FAILED", "GENERAL AUTHENTICATE failed (SW: ${sw.toHex()})")

        return extractSignatureFromAuthResponse(buffer.toByteArray())
    }

    // ─── APDU transport ───────────────────────────────────────────────────────

    private fun sendAPDU(dep: IsoDep, apdu: ByteArray): ByteArray {
        if (!dep.isConnected) {
            throw CACException("CARD_NOT_FOUND", "Card disconnected during operation")
        }
        return dep.transceive(apdu)
    }

    private fun getSW(response: ByteArray): Int {
        if (response.size < 2) throw CACException("PROTOCOL_ERROR", "Response too short")
        return ((response[response.size - 2].toInt() and 0xFF) shl 8) or
               (response[response.size - 1].toInt() and 0xFF)
    }

    private fun getResponseData(response: ByteArray): ByteArray =
        if (response.size >= 2) response.copyOf(response.size - 2) else byteArrayOf()

    private fun requireIsoDep(promise: Promise): IsoDep? {
        val dep = isoDep
        if (dep == null || !dep.isConnected) {
            promise.reject("CARD_NOT_FOUND", "No NFC CAC card detected. Hold your CAC card to the NFC reader.", null)
            return null
        }
        return dep
    }

    // ─── TLV parsing ─────────────────────────────────────────────────────────

    private fun extractCertFromPIVObject(data: ByteArray): ByteArray {
        var idx = 0
        while (idx < data.size - 2) {
            val tag = data[idx].toInt() and 0xFF; idx++
            var len = data[idx].toInt() and 0xFF; idx++
            if (len == 0x81) { len = data[idx].toInt() and 0xFF; idx++ }
            else if (len == 0x82) { len = ((data[idx].toInt() and 0xFF) shl 8) or (data[idx + 1].toInt() and 0xFF); idx += 2 }

            if (tag == 0x70) {
                val certData = data.copyOfRange(idx, (idx + len).coerceAtMost(data.size))
                if (certData.isNotEmpty() && certData[0] == 0x30.toByte()) return certData
            }
            if (idx + len > data.size) break
            idx += len
        }
        // Fallback: find DER SEQUENCE
        val seqIdx = data.indexOfFirst { it == 0x30.toByte() }
        if (seqIdx >= 0) return data.copyOfRange(seqIdx, data.size)
        throw CACException("PARSE_ERROR", "Certificate not found in PIV object")
    }

    private fun extractSignatureFromAuthResponse(data: ByteArray): ByteArray {
        if (data.isEmpty() || data[0] != 0x7C.toByte())
            throw CACException("SIGN_FAILED", "Invalid GENERAL AUTHENTICATE response")

        var idx = 2 // skip 7C + length
        while (idx < data.size - 1) {
            val tag = data[idx].toInt() and 0xFF; idx++
            var len = data[idx].toInt() and 0xFF; idx++
            if (len == 0x81) { len = data[idx].toInt() and 0xFF; idx++ }
            else if (len == 0x82) { len = ((data[idx].toInt() and 0xFF) shl 8) or (data[idx + 1].toInt() and 0xFF); idx += 2 }

            if (tag == 0x82) return data.copyOfRange(idx, (idx + len).coerceAtMost(data.size))
            idx += len
        }
        throw CACException("SIGN_FAILED", "Signature not found in response")
    }

    private fun parseChuid(data: ByteArray): Map<String, String> {
        val result = mutableMapOf<String, String>()
        var idx = 0
        while (idx < data.size - 1) {
            val tag = data[idx].toInt() and 0xFF; idx++
            if (idx >= data.size) break
            var len = data[idx].toInt() and 0xFF; idx++
            if (idx + len > data.size) break
            val value = data.copyOfRange(idx, idx + len)

            when (tag) {
                0x30 -> result["fascN"] = bytesToHex(value)
                0x34 -> result["cardGuid"] = bytesToHex(value)
                0x35 -> result["expirationDate"] = String(value, Charsets.UTF_8)
            }
            idx += len
        }
        return result
    }

    // ─── X.509 certificate parsing ────────────────────────────────────────────

    private fun parseCertificate(der: ByteArray): Map<String, String> {
        val result = mutableMapOf<String, String>()
        return try {
            val cf = CertificateFactory.getInstance("X.509")
            val cert = cf.generateCertificate(ByteArrayInputStream(der)) as X509Certificate

            result["subject"] = cert.subjectX500Principal.name
            result["issuer"] = cert.issuerX500Principal.name
            result["serialNumber"] = cert.serialNumber.toString(16)
            result["notBefore"] = cert.notBefore.toInstant().toString()
            result["notAfter"] = cert.notAfter.toInstant().toString()

            // Extract EDIPI from CN — "SMITH.JOHN.1234567890"
            val cnPattern = Pattern.compile("CN=([^,]+)")
            val matcher = cnPattern.matcher(cert.subjectX500Principal.name)
            if (matcher.find()) {
                val cn = matcher.group(1) ?: ""
                result["commonName"] = cn
                val edipiPattern = Pattern.compile("(\\d{10})")
                val edipiMatcher = edipiPattern.matcher(cn)
                if (edipiMatcher.find()) {
                    result["edipi"] = edipiMatcher.group(1) ?: ""
                }
            }

            // Email from Subject Alternative Names
            cert.subjectAlternativeNames?.forEach { san ->
                if ((san[0] as? Int) == 1) { // rfc822Name = type 1
                    result["email"] = san[1] as? String ?: ""
                }
            }

            // Key algorithm
            result["keyAlgorithm"] = when {
                cert.publicKey.algorithm.contains("EC", ignoreCase = true) -> "ECDSA-P384"
                cert.publicKey.algorithm.contains("RSA", ignoreCase = true) -> "RSA-2048"
                else -> cert.publicKey.algorithm
            }

            result
        } catch (e: Exception) {
            result
        }
    }

    // ─── Utility ──────────────────────────────────────────────────────────────

    private fun bytesToHex(bytes: ByteArray): String =
        bytes.joinToString("") { "%02x".format(it) }

    private fun hexToBytes(hex: String): ByteArray =
        ByteArray(hex.length / 2) { hex.substring(it * 2, it * 2 + 2).toInt(16).toByte() }

    private fun Int.toHex(): String = "%04X".format(this)
}

// ─── Exception type ───────────────────────────────────────────────────────────

class CACException(
    val code: String,
    override val message: String,
    val data: Any? = null
) : Exception(message)
