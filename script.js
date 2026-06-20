// ==================== CONFIGURATION ====================
const API_KEY = '695d3308c261443fc6e2084f4d0599baa323d8f1';
const BASE_URL = 'https://quicknum.xyz/api/external';
const INDIA_CODE = '91';

// ==================== STATE ====================
let state = {
    selectedService: null,
    activationId: null,
    services: [],
    activeActivations: []
};

// ==================== DOM ELEMENTS ====================
const elements = {
    balance: document.getElementById('balanceAmount'),
    serviceSearch: document.getElementById('serviceSearch'),
    serviceList: document.getElementById('serviceList'),
    activationContent: document.getElementById('activationContent'),
    loadingIndicator: document.getElementById('loadingIndicator'),
    historyList: document.getElementById('historyList'),
    getNumberBtn: document.querySelector('.btn-primary')
};

// ==================== API FUNCTIONS ====================
async function apiRequest(endpoint, params = {}) {
    params.api_key = API_KEY;
    params.type = 'json';
    
    const url = new URL(`${BASE_URL}/${endpoint}`);
    Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));
    
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        return null;
    }
}

async function fetchBalance() {
    try {
        const result = await apiRequest('balance');
        if (result && result.status === 'success') {
            elements.balance.textContent = `₹${result.balance}`;
            return result.balance;
        }
    } catch (error) {
        console.error('Balance error:', error);
    }
    return '0.00';
}

async function fetchServices() {
    try {
        const result = await apiRequest('service-codes');
        if (result && result.status === 'success') {
            state.services = result.services;
            renderServices(state.services);
            return state.services;
        }
    } catch (error) {
        console.error('Services error:', error);
    }
    return [];
}

function renderServices(services) {
    if (!services || services.length === 0) {
        elements.serviceList.innerHTML = '<div class="empty-state">No services found</div>';
        return;
    }
    
    elements.serviceList.innerHTML = services.map(service => `
        <div class="service-item ${state.selectedService === service.public_code ? 'active' : ''}"
             onclick="selectService(${service.public_code})"
             data-code="${service.public_code}">
            ${service.service_name}
        </div>
    `).join('');
}

function filterServices() {
    const query = elements.serviceSearch.value.toLowerCase().trim();
    if (!query) {
        renderServices(state.services);
        return;
    }
    
    const filtered = state.services.filter(s => 
        s.service_name.toLowerCase().includes(query)
    );
    renderServices(filtered);
}

function selectService(code) {
    state.selectedService = code;
    document.querySelectorAll('.service-item').forEach(el => {
        el.classList.toggle('active', parseInt(el.dataset.code) === code);
    });
}

async function getNumber() {
    if (!state.selectedService) {
        showToast('Please select a service first', 'warning');
        return;
    }
    
    elements.getNumberBtn.disabled = true;
    elements.loadingIndicator.classList.remove('hidden');
    
    try {
        // Check balance first
        const balance = await fetchBalance();
        if (parseFloat(balance) < 10) {
            showToast('Insufficient balance. Please recharge.', 'error');
            return;
        }
        
        // Get number
        const result = await apiRequest('get-number', {
            service: state.selectedService,
            country: INDIA_CODE
        });
        
        if (result && result.status === 'success') {
            state.activationId = result.id;
            showActivation(result);
            showToast('Number received successfully!', 'success');
            fetchHistory();
        } else {
            const msg = result?.message || 'Failed to get number';
            showToast(msg, 'error');
        }
    } catch (error) {
        console.error('Get number error:', error);
        showToast('An error occurred', 'error');
    } finally {
        elements.getNumberBtn.disabled = false;
        elements.loadingIndicator.classList.add('hidden');
    }
}

async function checkStatus(activationId) {
    try {
        const result = await apiRequest('get-status', { id: activationId });
        if (result && result.status === 'success') {
            showActivation(result);
            return result;
        }
    } catch (error) {
        console.error('Status error:', error);
    }
    return null;
}

async function changeActivationStatus(activationId, status) {
    try {
        const result = await apiRequest('change-status', {
            id: activationId,
            status: status
        });
        if (result && result.status === 'success') {
            showToast('Status updated successfully!', 'success');
            await checkStatus(activationId);
            fetchHistory();
            return result;
        }
    } catch (error) {
        console.error('Change status error:', error);
        showToast('Failed to update status', 'error');
    }
    return null;
}

async function fetchHistory() {
    try {
        const result = await apiRequest('active');
        if (result && result.status === 'success') {
            state.activeActivations = result.active || [];
            renderHistory(state.activeActivations);
            return state.activeActivations;
        }
    } catch (error) {
        console.error('History error:', error);
    }
    return [];
}

function renderHistory(activations) {
    if (!activations || activations.length === 0) {
        elements.historyList.innerHTML = `
            <div class="empty-state" style="padding:20px;">
                <p style="font-size:14px;">No recent activations</p>
            </div>
        `;
        return;
    }
    
    elements.historyList.innerHTML = activations.slice(0, 10).map(act => `
        <div class="history-item" onclick="loadActivation('${act.id}')">
            <div>
                <div class="service">${act.service_name || 'Unknown'}</div>
                <div class="number">${act.phone_number || 'N/A'}</div>
            </div>
            <div>
                <span class="status status-badge ${act.status}">${act.status || 'Unknown'}</span>
            </div>
        </div>
    `).join('');
}

async function loadActivation(id) {
    state.activationId = id;
    await checkStatus(id);
}

// ==================== UI FUNCTIONS ====================
function showActivation(data) {
    const code = data.code || 'N/A';
    const sms = data.sms || 'No SMS yet';
    const number = data.number || 'N/A';
    const status = data.status_code || 'WAIT';
    const serviceName = data.service_name || 
        state.services.find(s => s.public_code === state.selectedService)?.service_name || 'Unknown';
    
    const statusClass = status.toLowerCase();
    const statusDisplay = {
        'OK': '✅ Received',
        'WAIT': '⏳ Waiting',
        'CANCEL': '❌ Cancelled',
        'EXPIRED': '⏰ Expired'
    }[status] || status;
    
    elements.activationContent.innerHTML = `
        <div class="activation-detail">
            <div class="number-box">
                <span class="number">${number}</span>
                <button class="copy-btn" onclick="copyNumber('${number}')">
                    <i class="fas fa-copy"></i>
                </button>
            </div>
            
            <div class="info-grid">
                <div class="info-item">
                    <div class="label">Service</div>
                    <div class="value">${serviceName}</div>
                </div>
                <div class="info-item">
                    <div class="label">Status</div>
                    <div class="value">
                        <span class="status-badge ${statusClass}">${statusDisplay}</span>
                    </div>
                </div>
                <div class="info-item">
                    <div class="label">OTP Code</div>
                    <div class="value" style="font-size:20px;color:var(--primary-light);">
                        ${code !== 'N/A' ? code : '—'}
                    </div>
                </div>
                <div class="info-item">
                    <div class="label">SMS</div>
                    <div class="value" style="font-size:13px;word-break:break-all;">
                        ${sms}
                    </div>
                </div>
            </div>
            
            <div class="activation-actions">
                <button class="btn-status" onclick="checkStatus('${data.id || state.activationId}')">
                    <i class="fas fa-sync"></i> Refresh
                </button>
                <button class="btn-resend" onclick="resendSms('${data.id || state.activationId}')">
                    <i class="fas fa-redo"></i> Another SMS
                </button>
                <button class="btn-complete" onclick="completeActivation('${data.id || state.activationId}')">
                    <i class="fas fa-check"></i> Complete
                </button>
                <button class="btn-cancel-act" onclick="cancelActivation('${data.id || state.activationId}')">
                    <i class="fas fa-times"></i> Cancel
                </button>
            </div>
        </div>
    `;
}

async function resendSms(activationId) {
    showToast('Requesting another SMS...', 'info');
    // This is a notification - user needs to request OTP from provider
    showToast('Please request OTP from the provider again, then refresh', 'info');
}

async function completeActivation(activationId) {
    if (confirm('Mark this activation as complete?')) {
        await changeActivationStatus(activationId, 6);
    }
}

async function cancelActivation(activationId) {
    if (confirm('Cancel this activation? (You will get a refund)')) {
        await changeActivationStatus(activationId, 8);
        clearActivation();
    }
}

function clearActivation() {
    state.activationId = null;
    elements.activationContent.innerHTML = `
        <div class="empty-state">
            <i class="fas fa-inbox"></i>
            <p>No active activation</p>
            <span>Get a number to start</span>
        </div>
    `;
}

function copyNumber(number) {
    navigator.clipboard.writeText(number).then(() => {
        showToast('Number copied!', 'success');
    }).catch(() => {
        // Fallback
        const input = document.createElement('input');
        input.value = number;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
        showToast('Number copied!', 'success');
    });
}

// ==================== TOAST ====================
function showToast(message, type = 'info') {
    const colors = {
        success: '#00D4AA',
        error: '#FF6B6B',
        warning: '#FFD93D',
        info: '#6C3CE1'
    };
    
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        bottom: 24px;
        right: 24px;
        padding: 16px 24px;
        background: var(--dark-card);
        border: 1px solid ${colors[type] || colors.info};
        border-radius: 10px;
        color: white;
        font-size: 14px;
        z-index: 9999;
        max-width: 400px;
        animation: fadeIn 0.3s ease;
        box-shadow: 0 10px 40px rgba(0,0,0,0.5);
    `;
    toast.innerHTML = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// ==================== INIT ====================
async function init() {
    await fetchBalance();
    await fetchServices();
    await fetchHistory();
    
    // Auto-refresh every 30 seconds
    setInterval(() => {
        fetchBalance();
        if (state.activationId) {
            checkStatus(state.activationId);
        }
    }, 30000);
}

// Start when page loads
document.addEventListener('DOMContentLoaded', init);