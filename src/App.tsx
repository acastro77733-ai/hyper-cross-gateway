/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/// <reference types="vite/client" />
import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { Mail, CheckCircle2, Clock, ShieldCheck, Wallet, ArrowUpRight, ArrowDownLeft, Settings, Activity, Globe, Zap, Server } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Magic } from 'magic-sdk';
import { createWeb3Modal, defaultConfig, useWeb3Modal, useWeb3ModalAccount, useWeb3ModalProvider } from '@web3modal/ethers/react';

// --- Web3Modal Configuration ---
const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || '5bfa9c8d646441ac48e1e416de0b7773';
const PUBLIC_KALEIDO_RPC_URL = import.meta.env.VITE_KALEIDO_PUBLIC_RPC_URL || '';
const KALEIDO_CHAIN_ID = Number(import.meta.env.VITE_KALEIDO_CHAIN_ID || '13370');
const KALEIDO_CHAIN_NAME = import.meta.env.VITE_KALEIDO_CHAIN_NAME || 'Kaleido EVM';
const KALEIDO_CURRENCY_SYMBOL = import.meta.env.VITE_KALEIDO_CURRENCY_SYMBOL || 'ETH';
const KALEIDO_EXPLORER_URL = import.meta.env.VITE_KALEIDO_EXPLORER_URL || '';
const hasPublicKaleidoRpc = Boolean(PUBLIC_KALEIDO_RPC_URL);

const kaleidoTargetChain = {
  chainId: KALEIDO_CHAIN_ID,
  name: KALEIDO_CHAIN_NAME,
  currency: KALEIDO_CURRENCY_SYMBOL,
  explorerUrl: import.meta.env.VITE_KALEIDO_EXPLORER_URL || 'https://www.kaleido.io/',
  rpcUrl: PUBLIC_KALEIDO_RPC_URL
};

const fallbackMainnetChain = {
  chainId: 1,
  name: 'Ethereum Mainnet',
  currency: 'ETH',
  explorerUrl: 'https://etherscan.io',
  rpcUrl: 'https://cloudflare-eth.com'
};

const walletModalChain = hasPublicKaleidoRpc ? kaleidoTargetChain : fallbackMainnetChain;
const TARGET_CHAIN_ID = kaleidoTargetChain.chainId;

const metadata = {
  name: 'HC Gateway',
  description: 'Secure Web3 Gateway',
  url: window.location.origin,
  icons: ['https://avatars.githubusercontent.com/u/37784886']
};

createWeb3Modal({
  ethersConfig: defaultConfig({ metadata }),
  chains: [walletModalChain],
  projectId,
  enableAnalytics: true
});

// --- Magic.link & Ethers Setup ---
let magic: any = null;
if (import.meta.env.VITE_MAGIC_PUBLISHABLE_KEY) {
  magic = new Magic(import.meta.env.VITE_MAGIC_PUBLISHABLE_KEY);
}

type TradeRecord = {
  id: string;
  hash: string;
  to: string;
  amountEth: string;
  status: 'pending' | 'confirmed' | 'failed';
  submittedAt: string;
  walletLabel: string;
  nonce?: number;
  gasLimit?: string;
  explorerUrl?: string;
};

const TesseractCross = ({ className = '' }: { className?: string }) => (
  <div className={`tesseract-container ${className}`}>
    <div className="tesseract">
      <div className="tesseract-face front"></div>
      <div className="tesseract-face back"></div>
      <div className="tesseract-face right"></div>
      <div className="tesseract-face left"></div>
      <div className="tesseract-face top"></div>
      <div className="tesseract-face bottom"></div>

      <div className="inner-tesseract">
        <div className="inner-face inner-front"></div>
        <div className="inner-face inner-back"></div>
        <div className="inner-face inner-right"></div>
        <div className="inner-face inner-left"></div>
        <div className="inner-face inner-top"></div>
        <div className="inner-face inner-bottom"></div>
      </div>
    </div>
  </div>
);

const shortAddress = (value: string) => `${value.slice(0, 6)}...${value.slice(-4)}`;
const buildExplorerTxUrl = (hash: string) => {
  if (!KALEIDO_EXPLORER_URL || KALEIDO_EXPLORER_URL === 'https://www.kaleido.io/') {
    return '';
  }

  return `${KALEIDO_EXPLORER_URL.replace(/\/$/, '')}/tx/${hash}`;
};

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [email, setEmail] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [balance, setBalance] = useState('0.0000');
  const [secureAccount, setSecureAccount] = useState('');
  const [walletType, setWalletType] = useState<string>('');

  const [kaleidoChainId, setKaleidoChainId] = useState(TARGET_CHAIN_ID.toString());
  const [kaleidoNetworkName, setKaleidoNetworkName] = useState(kaleidoTargetChain.name);
  const [latestBlock, setLatestBlock] = useState('N/A');
  const [gasPriceGwei, setGasPriceGwei] = useState('N/A');
  const [kaleidoHealth, setKaleidoHealth] = useState<'healthy' | 'error'>('error');
  const [kaleidoError, setKaleidoError] = useState('');
  const [activeWalletChainId, setActiveWalletChainId] = useState('N/A');
  const [isWrongNetwork, setIsWrongNetwork] = useState(false);
  const [walletConnectError, setWalletConnectError] = useState('');
  const [isSwitchingChain, setIsSwitchingChain] = useState(false);
  const [switchChainError, setSwitchChainError] = useState('');

  const [showTradeModal, setShowTradeModal] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [setupStatus, setSetupStatus] = useState<{ success?: boolean; message?: string } | null>(null);

  const [tradeToAddress, setTradeToAddress] = useState('');
  const [tradeAmountEth, setTradeAmountEth] = useState('');
  const [tradeGasLimit, setTradeGasLimit] = useState('');
  const [tradeNonce, setTradeNonce] = useState('');
  const [isSubmittingTrade, setIsSubmittingTrade] = useState(false);
  const [tradeError, setTradeError] = useState('');
  const [trades, setTrades] = useState<TradeRecord[]>([]);

  const { open } = useWeb3Modal();
  const { address, isConnected } = useWeb3ModalAccount();
  const { walletProvider } = useWeb3ModalProvider();

  const detectWalletType = (provider: any) => {
    const raw = provider?.provider || provider;
    if (!raw) return '';

    if (raw.isTrust) return 'Trust Wallet';
    if (raw.isMetaMask) return 'MetaMask';
    if (raw.isCoin98) return 'Coin98';
    if (raw.isOKExWallet) return 'OKX Wallet';
    if (raw.isTokenary) return 'Tokenary';
    if (raw.isWalletConnect) return 'WalletConnect';

    const metadataName = provider?.session?.peer?.metadata?.name || '';
    if (metadataName) return metadataName;

    const providerName = raw?.name || '';
    if (providerName.includes('WalletConnect')) return 'WalletConnect';
    if (providerName.includes('MetaMask')) return 'MetaMask';
    if (providerName.includes('Trust')) return 'Trust Wallet';

    return 'Connected Wallet';
  };

  const getActiveBrowserProvider = () => {
    if (isConnected && walletProvider) {
      return {
        provider: new ethers.BrowserProvider(walletProvider),
        walletLabel: walletType || detectWalletType(walletProvider)
      };
    }
    if (isLoggedIn && magic) {
      return {
        provider: new ethers.BrowserProvider(magic.rpcProvider),
        walletLabel: 'Magic Wallet'
      };
    }
    return null;
  };

  const refreshRuntimeState = async () => {
    try {
      const response = await fetch('/api/kaleido/telemetry');
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.error || `Telemetry request failed (${response.status})`);
      }

      const data = await response.json();
      setKaleidoHealth('healthy');
      setKaleidoChainId(String(data.chainId || TARGET_CHAIN_ID));
      setKaleidoNetworkName(String(data.networkName || kaleidoTargetChain.name));
      setLatestBlock(String(data.latestBlock ?? 'N/A'));
      setGasPriceGwei(data.gasPriceGwei ? Number(data.gasPriceGwei).toFixed(2) : 'N/A');
      setKaleidoError('');
    } catch (error) {
      console.error('Kaleido telemetry fetch failed:', error);
      setKaleidoHealth('error');
      setKaleidoChainId(TARGET_CHAIN_ID.toString());
      setKaleidoNetworkName(kaleidoTargetChain.name);
      setLatestBlock('N/A');
      setGasPriceGwei('N/A');
      const message = error instanceof Error ? error.message : 'Unable to load Kaleido telemetry.';
      setKaleidoError(message);
    }

    try {
      const active = getActiveBrowserProvider();
      if (!active) return;

      const signer = await active.provider.getSigner();
      const currentAddress = await signer.getAddress();
      const [currentBalance, activeNetwork] = await Promise.all([
        active.provider.getBalance(currentAddress),
        active.provider.getNetwork()
      ]);

      setSecureAccount(shortAddress(currentAddress));
      setBalance(Number(ethers.formatEther(currentBalance)).toFixed(4));
      setActiveWalletChainId(activeNetwork.chainId.toString());
      setIsWrongNetwork(Number(activeNetwork.chainId) !== TARGET_CHAIN_ID);
    } catch (error) {
      console.error('Wallet refresh failed:', error);
    }
  };

  useEffect(() => {
    let interval: any;
    refreshRuntimeState();
    interval = setInterval(refreshRuntimeState, 12000);
    return () => clearInterval(interval);
  }, [isConnected, isLoggedIn, walletProvider, walletType]);

  useEffect(() => {
    if (isConnected && address) {
      setIsLoggedIn(true);
      setWalletConnectError('');
      setSwitchChainError('');
      setSecureAccount(shortAddress(address));
      const detected = detectWalletType(walletProvider);
      setWalletType(detected);
    }
  }, [isConnected, address, walletProvider]);

  const handleWalletConnect = async () => {
    setWalletConnectError('');
    try {
      await open();
    } catch (error: any) {
      const message = error?.message || 'Failed to open wallet connection modal.';
      setWalletConnectError(message);
    }
  };

  const handleSwitchToTargetChain = async () => {
    setSwitchChainError('');

    if (!walletProvider) {
      setSwitchChainError('No wallet provider available. Connect a wallet first.');
      return;
    }

    const rawProvider: any = (walletProvider as any)?.provider || walletProvider;
    if (!rawProvider?.request) {
      setSwitchChainError('Connected wallet does not support programmatic network switching.');
      return;
    }

    const chainIdHex = `0x${TARGET_CHAIN_ID.toString(16)}`;

    setIsSwitchingChain(true);
    try {
      await rawProvider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: chainIdHex }]
      });
      await refreshRuntimeState();
      return;
    } catch (switchError: any) {
      const switchCode = switchError?.code;
      if (switchCode === 4902) {
        if (!hasPublicKaleidoRpc) {
          setSwitchChainError('No public Kaleido RPC is configured for wallet_addEthereumChain. Configure VITE_KALEIDO_PUBLIC_RPC_URL or add the network manually in your wallet.');
          return;
        }

        try {
          await rawProvider.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: chainIdHex,
                chainName: kaleidoTargetChain.name,
                nativeCurrency: {
                  name: kaleidoTargetChain.currency,
                  symbol: kaleidoTargetChain.currency,
                  decimals: 18
                },
                rpcUrls: [kaleidoTargetChain.rpcUrl],
                blockExplorerUrls: kaleidoTargetChain.explorerUrl ? [kaleidoTargetChain.explorerUrl] : []
              }
            ]
          });

          await rawProvider.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: chainIdHex }]
          });
          await refreshRuntimeState();
          return;
        } catch (addError: any) {
          const addMessage = addError?.message || 'Unable to add target chain to wallet.';
          setSwitchChainError(addMessage);
          return;
        }
      }

      if (switchCode === 4001) {
        setSwitchChainError('Network switch request was rejected in wallet.');
        return;
      }

      const switchMessage = switchError?.message || 'Unable to switch wallet network.';
      setSwitchChainError(switchMessage);
      return;
    } finally {
      setIsSwitchingChain(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    if (!magic) {
      alert('SYSTEM ERROR: VITE_MAGIC_PUBLISHABLE_KEY is missing. Cannot establish live secure link.');
      return;
    }

    setIsLoggingIn(true);

    try {
      await magic.auth.loginWithMagicLink({ email });
      const magicProvider = new ethers.BrowserProvider(magic.rpcProvider);
      const signer = await magicProvider.getSigner();
      const connectedAddress = await signer.getAddress();
      const currentBalance = await magicProvider.getBalance(connectedAddress);

      setSecureAccount(shortAddress(connectedAddress));
      setBalance(Number(ethers.formatEther(currentBalance)).toFixed(4));
      setWalletType('Magic Wallet');
      setIsLoggedIn(true);
    } catch (error: any) {
      console.error('Magic login failed', error);
      const errorMessage = error?.message || String(error);

      if (errorMessage.includes('User canceled action')) {
        console.log('Login sequence aborted by user.');
      } else if (errorMessage.includes('has not approved access')) {
        alert(`ACCESS DENIED: Domain not whitelisted.\n\nPlease add this URL to your Magic.link Dashboard allowed domains:\n${window.location.origin}`);
      } else {
        alert('LOGIN FAILED: ' + errorMessage);
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    if (magic) {
      await magic.user.logout();
    }
    setIsLoggedIn(false);
    setEmail('');
    setSecureAccount('');
    setBalance('0.0000');
    setWalletType('');
  };

  const handleSetupIdentityProvider = async () => {
    setIsSettingUp(true);
    setSetupStatus(null);
    try {
      const response = await fetch('/api/magic/identity-provider', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const data = await response.json();
      if (response.ok) {
        setSwitchChainError('');
        setSetupStatus({ success: true, message: 'IDENTITY PROVIDER REGISTERED SUCCESSFULLY' });
      } else {
        setSetupStatus({ success: false, message: `SETUP FAILED: ${data.error || JSON.stringify(data)}` });
      }
    } catch (error) {
      console.error('Setup error:', error);
      setSetupStatus({ success: false, message: 'NETWORK ERROR DURING SETUP' });
    } finally {
      setIsSettingUp(false);
    }
  };

  const handleExecuteTrade = async (e: React.FormEvent) => {
    e.preventDefault();
    setTradeError('');

    const active = getActiveBrowserProvider();
    if (!active) {
      setTradeError('No wallet session is available. Connect a wallet or login via Magic first.');
      return;
    }

    if (!ethers.isAddress(tradeToAddress)) {
      setTradeError('Recipient must be a valid EVM wallet address.');
      return;
    }

    if (!tradeAmountEth || Number(tradeAmountEth) <= 0) {
      setTradeError('Transfer amount must be greater than zero.');
      return;
    }

    if (tradeGasLimit && (!Number.isInteger(Number(tradeGasLimit)) || Number(tradeGasLimit) <= 0)) {
      setTradeError('Gas limit must be a positive integer.');
      return;
    }

    if (tradeNonce && (!Number.isInteger(Number(tradeNonce)) || Number(tradeNonce) < 0)) {
      setTradeError('Nonce must be a non-negative integer.');
      return;
    }

    setIsSubmittingTrade(true);

    try {
      const signer = await active.provider.getSigner();
      const network = await active.provider.getNetwork();
      if (Number(network.chainId) !== TARGET_CHAIN_ID) {
        setTradeError(`Wrong network. Active wallet chain ${network.chainId.toString()} does not match target chain ${TARGET_CHAIN_ID}.`);
        setIsWrongNetwork(true);
        return;
      }

      const txRequest: ethers.TransactionRequest = {
        to: tradeToAddress,
        value: ethers.parseEther(tradeAmountEth)
      };

      if (tradeGasLimit) {
        txRequest.gasLimit = BigInt(tradeGasLimit);
      }

      if (tradeNonce) {
        txRequest.nonce = Number(tradeNonce);
      }

      const tx = await signer.sendTransaction(txRequest);

      const record: TradeRecord = {
        id: `TRD-${tx.hash.slice(2, 8).toUpperCase()}`,
        hash: tx.hash,
        to: tradeToAddress,
        amountEth: tradeAmountEth,
        status: 'pending',
        submittedAt: new Date().toISOString(),
        walletLabel: active.walletLabel,
        nonce: tx.nonce,
        gasLimit: txRequest.gasLimit ? txRequest.gasLimit.toString() : undefined,
        explorerUrl: buildExplorerTxUrl(tx.hash)
      };

      setTrades((prev) => [record, ...prev]);
      setShowTradeModal(false);
      setTradeToAddress('');
      setTradeAmountEth('');
      setTradeGasLimit('');
      setTradeNonce('');

      const receipt = await active.provider.waitForTransaction(tx.hash);
      setTrades((prev) =>
        prev.map((trade) =>
          trade.hash === tx.hash
            ? { ...trade, status: receipt?.status === 1 ? 'confirmed' : 'failed' }
            : trade
        )
      );
      await refreshRuntimeState();
    } catch (error: any) {
      console.error('Trade execution failed:', error);
      setTradeError(error?.message || 'Transaction failed.');
    } finally {
      setIsSubmittingTrade(false);
    }
  };

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen circuit-bg flex flex-col items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full glass-card p-8 space-y-8"
        >
          <div className="text-center space-y-4">
            <div className="mx-auto flex justify-center mb-12 mt-4">
              <TesseractCross />
            </div>
            <h1 className="text-4xl font-bold text-gold uppercase tracking-widest drop-shadow-lg">HC Gateway</h1>
            <p className="text-xl text-gold opacity-80 font-mono">AUTHORIZED PERSONNEL ONLY</p>
          </div>

          <div className="space-y-4">
            <button
              onClick={handleWalletConnect}
              className="w-full flex justify-center items-center py-4 px-4 glass-btn text-2xl"
            >
              <Globe className="mr-3 h-6 w-6" />
              CONNECT WALLET
            </button>
            {walletConnectError && (
              <p className="text-sm text-umbrella-red font-bold uppercase">{walletConnectError}</p>
            )}

            <div className="relative flex items-center py-2">
              <div className="flex-grow border-t border-gold/20"></div>
              <span className="flex-shrink mx-4 text-gold/40 text-sm uppercase">or secure link</span>
              <div className="flex-grow border-t border-gold/20"></div>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-6 w-6 text-gold opacity-50" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  className="block w-full pl-12 pr-3 py-4 glass-input text-xl"
                  placeholder="OPERATIVE_EMAIL@HC.GATEWAY"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoggingIn}
                />
              </div>

              <button
                type="submit"
                disabled={isLoggingIn || !email}
                className="w-full flex justify-center items-center py-4 px-4 glass-btn text-2xl disabled:opacity-50"
              >
                {isLoggingIn ? (
                  <Activity className="animate-spin mr-3 h-6 w-6" />
                ) : (
                  <Zap className="mr-3 h-6 w-6" />
                )}
                {isLoggingIn ? 'LINKING...' : 'MAGIC LINK'}
              </button>
            </form>
          </div>

          <div className="text-center mt-8 border-t border-gold/20 pt-4 space-y-4">
            <p className="text-lg text-gold opacity-60">SECURED BY MAGIC.LINK & KALEIDO</p>
            {!magic && <p className="text-sm text-umbrella-red mt-2 font-bold animate-pulse">CRITICAL ERROR: VITE_MAGIC_PUBLISHABLE_KEY MISSING. LIVE LINK OFFLINE.</p>}

            <div className="pt-4">
              <button
                onClick={() => setShowSetup(!showSetup)}
                className="text-sm text-gold opacity-40 hover:opacity-100 transition-opacity flex items-center justify-center mx-auto uppercase"
              >
                <Settings className="w-4 h-4 mr-2" />
                System Configuration
              </button>
            </div>

            <AnimatePresence>
              {showSetup && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="bg-dark-royal border border-gold border-opacity-30 p-4 space-y-4 mt-2">
                    <p className="text-sm text-gold opacity-80 uppercase">Register Identity Provider with Magic Labs TEE</p>
                    <button
                      onClick={handleSetupIdentityProvider}
                      disabled={isSettingUp}
                      className="w-full pixel-btn-secondary py-2 text-lg flex items-center justify-center disabled:opacity-50"
                    >
                      {isSettingUp ? (
                        <Activity className="w-5 h-5 mr-2 animate-pulse" />
                      ) : (
                        <ShieldCheck className="w-5 h-5 mr-2" />
                      )}
                      {isSettingUp ? 'PROCESSING...' : 'REGISTER IDENTITY PROVIDER'}
                    </button>
                    {setupStatus && (
                      <p className={`text-xs font-bold uppercase ${setupStatus.success ? 'text-green-400' : 'text-umbrella-red'}`}>
                        {setupStatus.message}
                      </p>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen circuit-bg pb-20">
      <header className="glass-card rounded-none border-t-0 border-l-0 border-r-0 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="scale-40 origin-left -my-8">
              <TesseractCross />
            </div>
            <span className="text-3xl font-bold tracking-widest uppercase text-gold drop-shadow-md">HC Gateway</span>
          </div>
          <div className="flex items-center space-x-4">
            {!isConnected ? (
              <button
                onClick={handleWalletConnect}
                className="text-lg font-medium text-gold bg-royal/40 backdrop-blur-md border border-gold/30 hover:border-gold hover:text-umbrella-red transition-all px-4 py-2 rounded-full uppercase"
              >
                <Globe className="w-5 h-5 inline mr-2" />
                CONNECT WALLET
              </button>
            ) : (
              <div className="hidden sm:flex items-center text-sm font-bold text-umbrella-red bg-royal/40 backdrop-blur-md border border-umbrella-red/50 px-4 py-2 rounded-full uppercase tracking-wider">
                <Wallet className="w-4 h-4 mr-2" />
                {walletType || 'Connected Wallet'}
              </div>
            )}
            <div className="hidden sm:flex items-center text-lg text-gold bg-royal/40 backdrop-blur-md border border-gold/30 px-4 py-2 rounded-full">
              <Wallet className="w-5 h-5 mr-2" />
              {secureAccount}
            </div>
            <button
              onClick={handleLogout}
              className="text-xl font-medium text-gold hover:text-umbrella-red transition-colors uppercase tracking-tighter"
            >
              TERMINATE
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="glass-card p-6 lg:col-span-2 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-20 group-hover:opacity-40 transition-opacity">
              <Zap className="w-20 h-20 text-gold" />
            </div>
            <div className="relative z-10">
              <p className="text-xl opacity-60 mb-2 uppercase tracking-widest">Live On-Chain Balance</p>
              <div className="flex items-baseline space-x-3">
                <h2 className="text-6xl sm:text-7xl font-bold tracking-tight text-umbrella-red drop-shadow-[0_0_15px_rgba(204,0,0,0.5)]">{balance}</h2>
                <span className="text-2xl font-medium uppercase text-gold/80">ETH</span>
              </div>
              <div className="mt-4 flex flex-wrap gap-3 text-sm uppercase tracking-wider">
                <span className="rounded-full border border-gold/20 bg-royal/30 px-3 py-1 text-gold/80">
                  Wallet Chain: {activeWalletChainId}
                </span>
                <span className={`rounded-full border px-3 py-1 ${isWrongNetwork ? 'border-umbrella-red/40 bg-umbrella-red/20 text-umbrella-red' : 'border-green-400/30 bg-green-500/10 text-green-300'}`}>
                  {isWrongNetwork ? 'Wrong Network' : 'Target Chain Matched'}
                </span>
              </div>
              {isWrongNetwork && (
                <div className="mt-4 max-w-2xl space-y-3">
                  <p className="text-sm font-bold uppercase text-umbrella-red">
                    Trading is locked until the connected wallet switches to target chain {TARGET_CHAIN_ID}.
                  </p>
                  <button
                    onClick={handleSwitchToTargetChain}
                    disabled={isSwitchingChain || !isConnected}
                    className="glass-btn-secondary px-4 py-2 text-sm disabled:opacity-50"
                  >
                    {isSwitchingChain ? 'SWITCHING...' : 'SWITCH NETWORK'}
                  </button>
                  {switchChainError && (
                    <p className="text-sm font-bold uppercase text-umbrella-red">{switchChainError}</p>
                  )}
                </div>
              )}
              <div className="mt-8 flex flex-col sm:flex-row gap-4">
                <button
                  onClick={() => setShowTradeModal(true)}
                  disabled={isWrongNetwork}
                  className="flex-1 glass-btn py-4 px-6 flex items-center justify-center text-xl"
                >
                  <ArrowUpRight className="w-6 h-6 mr-3" />
                  EXECUTE TRANSFER
                </button>
                <button
                  onClick={refreshRuntimeState}
                  className="flex-1 glass-btn-secondary py-4 px-6 flex items-center justify-center text-xl"
                >
                  <ArrowDownLeft className="w-6 h-6 mr-3" />
                  REFRESH TELEMETRY
                </button>
              </div>
            </div>
          </div>

          <div className="glass-card p-6 space-y-4">
            <div className="flex items-center text-gold/80 uppercase tracking-wider text-sm">
              <Server className="w-4 h-4 mr-2" />
              Kaleido Network Health
            </div>
            <div className={`text-sm font-bold uppercase ${kaleidoHealth === 'healthy' ? 'text-green-400' : 'text-umbrella-red'}`}>
              {kaleidoHealth === 'healthy' ? 'CONNECTED' : 'UNREACHABLE'}
            </div>
            <div className="text-sm text-gold/70">Chain ID: <span className="text-gold font-bold">{kaleidoChainId}</span></div>
            <div className="text-sm text-gold/70">Network: <span className="text-gold font-bold">{kaleidoNetworkName}</span></div>
            <div className="text-sm text-gold/70">Latest Block: <span className="text-gold font-bold">{latestBlock}</span></div>
            <div className="text-sm text-gold/70">Gas Price: <span className="text-gold font-bold">{gasPriceGwei} Gwei</span></div>
            <div className="text-sm text-gold/70">Explorer: <span className="text-gold font-bold">{KALEIDO_EXPLORER_URL || 'Not configured'}</span></div>
            <div className="text-xs text-gold/40 break-all">
              {PUBLIC_KALEIDO_RPC_URL || 'No public Kaleido wallet RPC configured'}
            </div>
            {kaleidoError && (
              <p className="text-xs text-umbrella-red break-words">{kaleidoError}</p>
            )}
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between border-b border-gold/20 pb-2">
            <h3 className="text-2xl font-bold uppercase tracking-widest text-gold/80">Trade Execution Log</h3>
            <span className="text-sm text-gold/60 uppercase">{trades.length} operations</span>
          </div>

          <div className="glass-card overflow-hidden">
            {trades.length === 0 ? (
              <div className="p-8 text-center text-gold/60 uppercase tracking-wider">
                No live transfers yet. Execute a transfer to create on-chain operations.
              </div>
            ) : (
              <ul className="divide-y divide-gold/10">
                {trades.map((trade) => (
                  <li key={trade.hash} className="p-5 hover:bg-white/5 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <p className="text-lg font-semibold uppercase text-gold">
                          {trade.walletLabel}
                          {' -> '}
                          {shortAddress(trade.to)}
                        </p>
                        <p className="text-sm text-gold/60">REF: {trade.id}</p>
                        <p className="text-sm text-gold/50 break-all">{trade.hash}</p>
                        {trade.explorerUrl && (
                          <a
                            href={trade.explorerUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center text-sm font-semibold uppercase text-gold underline decoration-gold/40 underline-offset-4 hover:text-umbrella-red"
                          >
                            View In Explorer
                          </a>
                        )}
                        <p className="text-xs text-gold/40">{new Date(trade.submittedAt).toLocaleString()}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-umbrella-red">-{trade.amountEth} ETH</p>
                        {typeof trade.nonce === 'number' && (
                          <p className="text-xs uppercase text-gold/50">Nonce {trade.nonce}</p>
                        )}
                        {trade.gasLimit && (
                          <p className="text-xs uppercase text-gold/50">Gas {trade.gasLimit}</p>
                        )}
                        {trade.status === 'pending' && (
                          <span className="inline-flex items-center text-sm font-medium text-gold bg-royal/30 border border-gold/20 px-3 py-1 rounded-full uppercase">
                            <Clock className="w-4 h-4 mr-2" />
                            Pending
                          </span>
                        )}
                        {trade.status === 'confirmed' && (
                          <span className="inline-flex items-center text-sm font-medium text-white bg-green-700/60 border border-green-400/40 px-3 py-1 rounded-full uppercase">
                            <CheckCircle2 className="w-4 h-4 mr-2" />
                            Confirmed
                          </span>
                        )}
                        {trade.status === 'failed' && (
                          <span className="inline-flex items-center text-sm font-medium text-white bg-umbrella-red/40 border border-umbrella-red/40 px-3 py-1 rounded-full uppercase">
                            <ShieldCheck className="w-4 h-4 mr-2" />
                            Failed
                          </span>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </main>

      <AnimatePresence>
        {showTradeModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-md"
              onClick={() => setShowTradeModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 40 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 40 }}
              className="relative glass-card w-full max-w-lg overflow-hidden z-10"
            >
              <div className="p-8">
                <div className="flex items-center space-x-5 mb-8 border-b border-gold/20 pb-6">
                  <div className="scale-40 origin-left -my-8">
                    <TesseractCross />
                  </div>
                  <h3 className="text-3xl font-bold uppercase tracking-widest text-umbrella-red drop-shadow-md">EXECUTE TRADE</h3>
                </div>

                <form className="space-y-6" onSubmit={handleExecuteTrade}>
                  <div>
                    <label className="block text-sm font-medium mb-2 uppercase text-gold/70">Recipient Wallet Address</label>
                    <input
                      type="text"
                      required
                      placeholder="0x..."
                      value={tradeToAddress}
                      onChange={(e) => setTradeToAddress(e.target.value.trim())}
                      className="w-full px-4 py-4 glass-input text-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2 uppercase text-gold/70">Transfer Amount (ETH)</label>
                    <input
                      type="number"
                      required
                      min="0"
                      step="0.0001"
                      placeholder="0.1000"
                      value={tradeAmountEth}
                      onChange={(e) => setTradeAmountEth(e.target.value)}
                      className="w-full px-4 py-4 glass-input text-2xl font-bold"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2 uppercase text-gold/70">Gas Limit (Optional)</label>
                      <input
                        type="number"
                        min="21000"
                        step="1"
                        placeholder="21000"
                        value={tradeGasLimit}
                        onChange={(e) => setTradeGasLimit(e.target.value)}
                        className="w-full px-4 py-4 glass-input text-lg"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2 uppercase text-gold/70">Nonce Override (Optional)</label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        placeholder="Auto"
                        value={tradeNonce}
                        onChange={(e) => setTradeNonce(e.target.value)}
                        className="w-full px-4 py-4 glass-input text-lg"
                      />
                    </div>
                  </div>

                  <div className="bg-royal/20 border border-umbrella-red/30 p-4 rounded-xl flex items-start space-x-4">
                    <ShieldCheck className="w-6 h-6 text-umbrella-red shrink-0 mt-0.5" />
                    <p className="text-sm text-gold/80 uppercase leading-relaxed">
                      Transactions execute directly on-chain through your active wallet session.
                      Confirm in your wallet prompt to broadcast.
                    </p>
                  </div>

                  {isWrongNetwork && (
                    <div className="space-y-3">
                      <p className="text-sm font-bold uppercase text-umbrella-red">
                        Wrong network detected. Switch wallet to chain {TARGET_CHAIN_ID} before submitting.
                      </p>
                      <button
                        type="button"
                        onClick={handleSwitchToTargetChain}
                        disabled={isSwitchingChain || !isConnected}
                        className="w-full glass-btn-secondary py-3 text-sm disabled:opacity-50"
                      >
                        {isSwitchingChain ? 'SWITCHING...' : 'SWITCH NETWORK'}
                      </button>
                      {switchChainError && (
                        <p className="text-sm font-bold uppercase text-umbrella-red">{switchChainError}</p>
                      )}
                    </div>
                  )}

                  {tradeError && (
                    <p className="text-sm text-umbrella-red font-bold uppercase">{tradeError}</p>
                  )}

                  <div className="pt-2 flex gap-4">
                    <button
                      type="button"
                      onClick={() => setShowTradeModal(false)}
                      className="flex-1 glass-btn-secondary py-4 text-lg"
                    >
                      CANCEL
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmittingTrade || isWrongNetwork}
                      className="flex-1 glass-btn py-4 text-lg disabled:opacity-50"
                    >
                      {isSubmittingTrade ? 'SUBMITTING...' : 'AUTHORIZE TRADE'}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
