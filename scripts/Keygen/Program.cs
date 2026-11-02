using System.Security.Cryptography;

// Generate local development keys so only the identity service can sign access tokens.
if (args.Length != 2)
{
    throw new ArgumentException("Pass the public-key and private-key output paths.");
}

// Keep the signing key private to Identity and give every other API only the verification key.
using var rsa = RSA.Create(3072);
File.WriteAllText(args[0], rsa.ExportSubjectPublicKeyInfoPem());
File.WriteAllText(args[1], rsa.ExportPkcs8PrivateKeyPem());
