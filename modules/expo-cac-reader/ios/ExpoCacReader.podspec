require 'json'
package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'ExpoCacReader'
  s.version        = package['version']
  s.summary        = package['description']
  s.license        = package['license']
  s.authors        = package['author']
  s.homepage       = package['homepage']
  s.platform       = :ios, '16.0'
  s.swift_version  = ['5.4', '5.5', '5.6', '5.7', '5.8', '5.9']
  s.source         = { git: '' }

  # Source files
  s.source_files   = "**/*.{h,m,mm,swift,hpp,cpp}"

  # CryptoTokenKit — required for smart card communication
  s.frameworks     = [
    'CryptoTokenKit',  # Smart card APDU communication
    'Security',        # Certificate parsing
    'Foundation',
    'UIKit'
  ]

  # Expo Modules Core — the bridge between Swift and JS
  s.dependency 'ExpoModulesCore'

  # Entitlements required:
  # - com.apple.security.smartcard (for CryptoTokenKit TKSmartCard)
  # Add to your app's .entitlements file:
  # <key>com.apple.security.smartcard</key>
  # <true/>
  #
  # Info.plist additions needed:
  # <key>NFCReaderUsageDescription</key>
  # <string>Tabula Medica uses NFC to read your DoD CAC card for secure authentication.</string>
  # <key>com.apple.token</key>  ← Smart card token extension
  # <array>
  #   <string>com.apple.setoken</string>
  # </array>
end
