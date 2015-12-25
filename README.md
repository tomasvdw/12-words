# 12-words

This is the source code for the website https://12-words.com; a service to transfer files from browser to 
browser using client side encryption.

## Install

The web/ folder contains the client application. It is configured to be hosted on and upload to S3. Some configuration options
are available in 12-words.js

The site can also be hosted by the minimal webserver found in srv/ written in rust. To do this set (in 12-words.js)

    UPLOAD_AWS=false
   
and run the server using:

    cargo run
    
## How it works

A file is uploaded using the following steps:

1. A passphrase is generated from a wordfile (from BIP39), using a (Fortuna) PRNG
2. The passphrase is transformed into a filename using 100 rounds SHA-512
3. The passphrase is transformed, with a salt into an encryption key using 1000 rounds PBKDF2
4. The input files are compressed and encrypted using the encryption key (3) and AES-256
5. The encrypted file is uploaded with the filename (2).

To retain a file, the incoming money is checked using a HD bitcoin address. The address is derived from a public root key
and the filename (2).

When a file is downloaded, the filename is determined using the same 100 rounds SHA-512.

## References

The services uses:

* https://github.com/digitalbazaar/forge for encryption (patched with Little Endian CTR support)
* https://github.com/gildas-lormeau/zip.js for compression (patched with ZIP64 & AES support)
* https://github.com/bitcoinjs/bitcoinjs-lib for bitcoin HD address derivation
* https://github.com/davidshimjs/qrcodejs for qr-code generation
* https://github.com/aws/aws-sdk-js for s3 multipart uploads

