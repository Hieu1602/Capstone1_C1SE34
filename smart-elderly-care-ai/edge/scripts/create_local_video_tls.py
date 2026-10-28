"""Create and verify a local-only certificate; never overwrite an existing key."""
from datetime import datetime, timedelta, timezone
from pathlib import Path
import ssl

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import ExtendedKeyUsageOID, NameOID


def main():
    directory = Path(__file__).resolve().parents[2] / ".local" / "video-tls"
    directory.mkdir(parents=True, exist_ok=True)
    certificate, private_key = directory / "certificate.pem", directory / "private-key.pem"
    if certificate.exists() != private_key.exists():
        raise RuntimeError("Incomplete TLS pair; inspect local files before regenerating")
    if not certificate.exists():
        key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "video-metadata")])
        now = datetime.now(timezone.utc)
        cert = (x509.CertificateBuilder().subject_name(name).issuer_name(name)
                .public_key(key.public_key()).serial_number(x509.random_serial_number())
                .not_valid_before(now - timedelta(minutes=5)).not_valid_after(now + timedelta(days=365))
                .add_extension(x509.SubjectAlternativeName([x509.DNSName("video-metadata")]), critical=False)
                .add_extension(x509.BasicConstraints(ca=True, path_length=0), critical=True)
                .add_extension(x509.KeyUsage(digital_signature=True, content_commitment=False,
                    key_encipherment=True, data_encipherment=False, key_agreement=False,
                    key_cert_sign=True, crl_sign=True, encipher_only=None, decipher_only=None), critical=True)
                .add_extension(x509.ExtendedKeyUsage([ExtendedKeyUsageOID.SERVER_AUTH]), critical=False)
                .add_extension(x509.SubjectKeyIdentifier.from_public_key(key.public_key()), critical=False)
                .add_extension(x509.AuthorityKeyIdentifier.from_issuer_public_key(key.public_key()), critical=False)
                .sign(key, hashes.SHA256()))
        with private_key.open("xb") as stream:
            stream.write(key.private_bytes(serialization.Encoding.PEM,
                serialization.PrivateFormat.PKCS8, serialization.NoEncryption()))
        private_key.chmod(0o600)
        with certificate.open("xb") as stream:
            stream.write(cert.public_bytes(serialization.Encoding.PEM))

    # Self-check the actual TLS handshake, trust chain, expiry and DNS name.
    server_context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    server_context.load_cert_chain(certificate, private_key)
    client_context = ssl.create_default_context(cafile=str(certificate))
    client_in, client_out, server_in, server_out = [ssl.MemoryBIO() for _ in range(4)]
    client = client_context.wrap_bio(client_in, client_out, server_hostname="video-metadata")
    server = server_context.wrap_bio(server_in, server_out, server_side=True)
    complete = set()
    for _ in range(10):
        for peer, outgoing, incoming in ((client, client_out, server_in), (server, server_out, client_in)):
            try:
                peer.do_handshake()
                complete.add(peer)
            except ssl.SSLWantReadError:
                pass
            data = outgoing.read()
            if data:
                incoming.write(data)
        if len(complete) == 2:
            print("Local TLS certificate verified for video-metadata; valid for up to 365 days.")
            return
    raise RuntimeError("TLS handshake self-check did not complete")


if __name__ == "__main__":
    main()
