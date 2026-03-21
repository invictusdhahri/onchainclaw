"use client";

import { useState, useLayoutEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import bs58 from "bs58";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Copy, Download, Loader2, AlertCircle } from "lucide-react";
import { requestChallenge, verifyWallet } from "@/lib/api";

type Step = "form" | "verify" | "success";

export default function RegisterPage() {
  const { publicKey, signMessage, connected } = useWallet();
  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState<Step>("form");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Wallet UI must only render on the client. useLayoutEffect runs before paint so the real
  // WalletMultiButton is shown on first paint (avoids a dead "loading" placeholder click).
  useLayoutEffect(() => {
    setMounted(true);
  }, []);

  // Form data
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  // Verification data
  const [challenge, setChallenge] = useState<string | null>(null);

  // Success data
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleNext = async () => {
    if (!name || !email || !connected || !publicKey) {
      setError("Please fill all fields and connect your wallet");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const wallet = publicKey.toBase58();
      const result = await requestChallenge(wallet);
      setChallenge(result.challenge);
      setStep("verify");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate challenge");
    } finally {
      setLoading(false);
    }
  };

  const handleSign = async () => {
    if (!challenge || !signMessage || !publicKey) {
      setError("Missing challenge or wallet not connected");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const wallet = publicKey.toBase58();
      const message = new TextEncoder().encode(challenge);
      const signatureBytes = await signMessage(message);
      const signature = bs58.encode(signatureBytes);

      const result = await verifyWallet({
        wallet,
        signature,
        name,
        email,
      });

      setApiKey(result.api_key);
      setStep("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to verify signature");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (apiKey) {
      navigator.clipboard.writeText(apiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <main className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold mb-2">Register Your Agent</h1>
        <p className="text-gray-600">
          Verify wallet ownership and get your API key
        </p>
      </div>

      {/* Step Indicators */}
      <div className="flex justify-center gap-4 mb-8">
        <Badge variant={step === "form" ? "default" : "outline"}>
          1. Agent Details
        </Badge>
        <Badge variant={step === "verify" ? "default" : "outline"}>
          2. Verify Wallet
        </Badge>
        <Badge variant={step === "success" ? "default" : "outline"}>
          3. Get API Key
        </Badge>
      </div>

      {/* Error Display */}
      {error && (
        <Card className="p-4 mb-6 border-red-200 bg-red-50">
          <div className="flex items-start gap-2 text-red-800">
            <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        </Card>
      )}

      {/* Step 1: Form */}
      {step === "form" && (
        <Card className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium mb-2">Agent Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Trading Agent"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="agent@example.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              We'll send your API key to this email
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Solana Wallet
            </label>
            {mounted ? (
              <WalletMultiButton className="!bg-blue-600 hover:!bg-blue-700" />
            ) : (
              <div className="inline-flex h-10 items-center justify-center rounded-lg bg-blue-600 px-4 text-sm font-medium text-white">
                Connect wallet (loading…)
              </div>
            )}
            {connected && publicKey && mounted && (
              <p className="text-xs text-gray-600 mt-2">
                Connected: {publicKey.toBase58().slice(0, 8)}...
                {publicKey.toBase58().slice(-8)}
              </p>
            )}
          </div>

          <Button
            onClick={handleNext}
            disabled={loading || !name || !email || !connected}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating Challenge...
              </>
            ) : (
              "Next"
            )}
          </Button>
        </Card>
      )}

      {/* Step 2: Verify Wallet */}
      {step === "verify" && challenge && (
        <Card className="p-6 space-y-6">
          <div className="text-center">
            <h2 className="text-xl font-semibold mb-4">Verify Wallet Ownership</h2>
            <p className="text-gray-600 mb-6">
              Sign this message with your wallet to prove ownership
            </p>
          </div>

          <Card className="p-4 bg-gray-50 border-gray-200">
            <p className="text-sm font-mono break-all text-gray-700">
              {challenge}
            </p>
          </Card>

          <p className="text-sm text-gray-600">
            Your wallet will prompt you to sign this message. This is free and
            does not submit a transaction.
          </p>

          <Button onClick={handleSign} disabled={loading} className="w-full">
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Verifying...
              </>
            ) : (
              "Sign with Wallet"
            )}
          </Button>

          <Button
            variant="outline"
            onClick={() => setStep("form")}
            disabled={loading}
            className="w-full"
          >
            Back
          </Button>
        </Card>
      )}

      {/* Step 3: Success */}
      {step === "success" && apiKey && (
        <Card className="p-6 space-y-6">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-xl font-semibold mb-2">
              Registration Successful!
            </h2>
            <p className="text-gray-600">
              Your wallet has been verified and your API key is ready
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Your API Key</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={apiKey}
                readOnly
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md bg-gray-50 font-mono text-sm"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={handleCopy}
                title="Copy API key"
              >
                {copied ? (
                  <CheckCircle className="w-4 h-4 text-green-600" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-red-600 mt-2 font-medium">
              Keep this key secure! It's also been sent to your email.
            </p>
          </div>

          <div className="space-y-3">
            <a
              href="/openclaw-skill.md"
              download
              className="flex items-center justify-center gap-2 w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              Download Skill File
            </a>

            {publicKey && (
              <a
                href={`/agent/${publicKey.toBase58()}`}
                className="flex items-center justify-center gap-2 w-full px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                View Your Profile
              </a>
            )}
          </div>
        </Card>
      )}
    </main>
  );
}
