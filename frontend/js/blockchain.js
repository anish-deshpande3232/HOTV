/* =========================================================
   blockchain.js — MetaMask / Ethers.js frontend integration
   Gracefully degrades if MetaMask not present.
   ========================================================= */

const Blockchain = {
  CONTRACT_ADDRESS: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
  CHAIN_ID: 31337,  // Hardhat local; change to 80001 for Polygon Mumbai
  provider: null,
  signer:   null,
  contract: null,
  address:  null,

  async connect() {
    if (!window.ethereum) {
      showToast("MetaMask not detected — install at metamask.io", "warning");
      return { success: false };
    }
    try {
      await window.ethereum.request({ method: "eth_requestAccounts" });
      // ethers v6 syntax; if using v5 replace with ethers.providers.Web3Provider
      const ethersLib = window.ethers;
      if (ethersLib) {
        this.provider = new ethersLib.providers.Web3Provider(window.ethereum);
        this.signer   = this.provider.getSigner();
        this.address  = await this.signer.getAddress();
      } else {
        // Fallback without ethers: just get address
        const accounts = await window.ethereum.request({ method: "eth_accounts" });
        this.address = accounts[0];
      }
      localStorage.setItem("walletAddress", this.address);
      showToast("Wallet connected: " + this.shortAddr(this.address), "success");
      this.updateBadge();
      return { success: true, address: this.address };
    } catch (err) {
      showToast("Wallet connection failed: " + err.message, "error");
      return { success: false, error: err.message };
    }
  },

  getAddress() {
    return this.address || localStorage.getItem("walletAddress");
  },

  shortAddr(addr) {
    if (!addr) return "—";
    return addr.slice(0, 6) + "…" + addr.slice(-4);
  },

  updateBadge() {
    const addr = this.getAddress();
    const el   = document.getElementById("wallet-badge");
    if (!el) return;
    el.innerHTML = addr
      ? `<span class="badge badge-green">⬡ ${this.shortAddr(addr)}</span>`
      : `<span class="badge badge-gray">No Wallet</span>`;
  },

  async signMessage(data) {
    if (!this.signer) return { sig: null, simulated: true };
    try {
      const sig = await this.signer.signMessage(JSON.stringify(data));
      return { sig, simulated: false };
    } catch {
      return { sig: "0x" + Array.from({length:130},()=>Math.floor(Math.random()*16).toString(16)).join(""), simulated: true };
    }
  }
};

/* Auto-connect on load if previously connected */
window.addEventListener("load", () => {
  if (localStorage.getItem("walletAddress")) {
    Blockchain.updateBadge();
  }
});
