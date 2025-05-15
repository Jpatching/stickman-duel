// Solana integration for Stickman Duel
let wallet = null;
let connection = null;
const DEVNET_ENDPOINT = 'https://api.devnet.solana.com';
const LAMPORTS_PER_SOL = 1000000000;

// Game state
let isWalletConnected = false;
let playerBalance = 0;
let stakeAmount = 0.01;
let gamePublicKey = null;

// Initialize Solana connection
function initSolana() {
  try {
    connection = new solanaWeb3.Connection(DEVNET_ENDPOINT);
    console.log('Connected to Solana devnet');

    // Add event listeners for buttons
    document.getElementById('play-offline').addEventListener('click', startOfflineGame);
    document.getElementById('connect-wallet').addEventListener('click', connectWallet);
  } catch (err) {
    console.error('Failed to connect to Solana network:', err);
  }
}

// Start offline game
function startOfflineGame() {
  console.log('Starting offline game...');
  document.getElementById('intro-screen').style.display = 'none';
  document.getElementById('game-container').style.display = 'block';
}

// Connect to Phantom wallet
async function connectWallet() {
  try {
    const resp = await window.solana.connect();
    wallet = resp.publicKey.toString();
    console.log('Wallet connected:', wallet);

    // Transition to game screen
    document.getElementById('intro-screen').style.display = 'none';
    document.getElementById('game-container').style.display = 'block';
  } catch (err) {
    console.error('Error connecting to wallet:', err);
  }
}

// Check if Phantom wallet is installed
function checkIfPhantomIsInstalled() {
  if ('solana' in window && window.solana.isPhantom) {
    console.log('Phantom wallet is installed');
    document.getElementById('wallet-status').textContent = 'Phantom wallet detected';
  } else {
    console.log('Phantom wallet is not installed');
    document.getElementById('wallet-status').textContent = 'Please install Phantom wallet extension';
    document.getElementById('connect-wallet').disabled = true;
  }
}

// Connect to Phantom wallet
async function connectPhantomWallet() {
  try {
    const resp = await window.solana.connect();
    wallet = resp.publicKey.toString();
    isWalletConnected = true;
    
    document.getElementById('wallet-status').textContent = 'Connected: ' + wallet.substring(0, 4) + '...' + wallet.substring(wallet.length - 4);
    document.getElementById('connect-wallet').textContent = 'Disconnect';
    document.getElementById('connect-wallet').removeEventListener('click', connectPhantomWallet);
    document.getElementById('connect-wallet').addEventListener('click', disconnectPhantomWallet);
    
    // Enable game button
    document.getElementById('start-game').disabled = false;
    document.getElementById('game-status').textContent = 'Ready to play! Set your stake.';
    
    // Get wallet balance
    await updateWalletBalance();
    
    // Add wallet change listener
    window.solana.on('accountChanged', async () => {
      wallet = await window.solana.publicKey.toString();
      await updateWalletBalance();
    });
    
    // Hide intro screen and show game container
    document.getElementById('intro-screen').style.display = 'none';
    document.getElementById('game-container').style.display = 'block';
    
  } catch (err) {
    console.error('Error connecting to wallet:', err);
    updateStatus('Failed to connect wallet', 'error');
  }
}

// Disconnect wallet
function disconnectPhantomWallet() {
  window.solana.disconnect();
  isWalletConnected = false;
  wallet = null;
  
  document.getElementById('wallet-status').textContent = 'Wallet not connected';
  document.getElementById('connect-wallet').textContent = 'Connect Wallet';
  document.getElementById('connect-wallet').removeEventListener('click', disconnectPhantomWallet);
  document.getElementById('connect-wallet').addEventListener('click', connectPhantomWallet);
  
  document.getElementById('wallet-balance').classList.add('hidden');
  document.getElementById('start-game').disabled = true;
  document.getElementById('game-status').textContent = 'Connect wallet to play';
}

// Update wallet balance
async function updateWalletBalance() {
  try {
    const publicKey = new solanaWeb3.PublicKey(wallet);
    const balance = await connection.getBalance(publicKey);
    playerBalance = balance / LAMPORTS_PER_SOL;
    
    document.getElementById('wallet-balance').textContent = `Balance: ${playerBalance.toFixed(4)} SOL`;
    document.getElementById('wallet-balance').classList.remove('hidden');
  } catch (err) {
    console.error('Error fetching balance:', err);
  }
}

// Update stake amount
function updateStakeAmount(e) {
  stakeAmount = parseFloat(e.target.value);
  if (stakeAmount > playerBalance) {
    document.getElementById('game-status').textContent = `Insufficient balance for this stake`;
    document.getElementById('start-game').disabled = true;
  } else {
    document.getElementById('game-status').textContent = `Ready to stake ${stakeAmount} SOL`;
    if (isWalletConnected) {
      document.getElementById('start-game').disabled = false;
    }
  }
}

// Start game with stake
function startGameWithStake() {
  if (!isWalletConnected || stakeAmount <= 0) {
    return;
  }

  document.getElementById('game-status').textContent = `Finding opponent with ${stakeAmount} SOL stake...`;
  document.getElementById('start-game').disabled = true;
  
  // Emit stake info to server for matchmaking
  emitStakeInfo(stakeAmount);
  
  // Show the game canvas
  document.getElementById('game').classList.remove('hidden');
}

// Function to be called from game.js
function emitStakeInfo(amount) {
  // This function will be called from game.js
  console.log(`Emitting stake amount: ${amount} SOL`);
  return {
    wallet: wallet,
    amount: amount
  };
}

// Send stake to an escrow account
async function sendStakeToEscrow(opponent, amount) {
  try {
    // In a production environment, this would involve:
    // 1. Creating a transaction to send SOL to an escrow account
    // 2. Having the user sign the transaction
    // 3. Confirming the transaction on the blockchain
    
    // For this demo, we'll just simulate it
    console.log(`Sending ${amount} SOL stake to escrow for match with ${opponent}`);
    return {
      success: true,
      transactionId: 'simulated-transaction-' + Date.now()
    };
  } catch (err) {
    console.error('Error sending stake:', err);
    return { success: false, error: err.message };
  }
}

// Function to settle match outcome
async function settleMatch(winner, loser, amount) {
  console.log(`Match settled: ${winner} wins ${amount * 2} SOL from ${loser}`);
  // In a real implementation, this would trigger a transaction
  // from the escrow account to the winner's wallet
  
  if (wallet === winner) {
    document.getElementById('game-status').textContent = `You won ${amount * 2} SOL!`;
  } else {
    document.getElementById('game-status').textContent = `You lost ${amount} SOL!`;
  }
  
  // Update balance after a short delay
  setTimeout(updateWalletBalance, 2000);
}

// Update status
function updateStatus(message, type = 'info') {
  document.getElementById('game-status').textContent = message;
}

// Initialize when the page loads
document.addEventListener('DOMContentLoaded', initSolana);

// Export functions for game.js to use
window.solanaFunctions = {
  emitStakeInfo,
  sendStakeToEscrow,
  settleMatch
};