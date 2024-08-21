let selectedPrice = null;
let selectedDataItem = null;
let isUserValid = false;

function showAlert(message, type) {
    const alert = document.querySelector(`.alert.${type}`);
    alert.querySelector('.message').textContent = message;
    alert.classList.add('show');

    // Hide alert after 3 seconds
    setTimeout(() => {
        alert.classList.remove('show');
    }, 3000);
}

function checkApi() {
    const userId = document.getElementById('UUID').value;
    const zoneId = document.getElementById('SERVER').value;

    if (userId.trim() === '' || zoneId.trim() === '') {
        showAlert('Please input both user ID and zone ID', 'error');
        return;
    }

    document.getElementById('checkID').innerText = 'Loading...';

    const url = 'https://api.elitedias.com/checkid';
    const headers = {
        'Origin': 'dev.api.elitedias.com',
    };

    const payload = {
        'userid': userId,
        'serverid': zoneId,
        'game': 'mlbb',
    };

    $.ajax({
        type: 'POST',
        url: url,
        headers: headers,
        data: JSON.stringify(payload),
        contentType: 'application/json',
        timeout: 60000,
        success: function (response) {
            if (response.valid === 'valid') {
                isUserValid = true;
                invalidMessage.textContent = response.name ? `User: ${response.name}` : 'Valid ID, but name not provided.';
                document.getElementById('invalidMessage').style.color = 'lawngreen';
                showAlert('User: ' + response.name, 'success');
                document.getElementById('checkID').innerText = 'Check';
                enablePaymentButton();
            } else if (response.valid === 'invalid') {
                isUserValid = false;
                invalidMessage.textContent = 'User not found';
                document.getElementById('invalidMessage').style.color = 'red';
                document.getElementById('checkID').innerText = 'Check';
                showAlert('User not found!', 'error');
                disablePaymentButton();
            } else {
                isUserValid = false;
                invalidMessage.textContent = 'Unexpected response.';
                disablePaymentButton();
            }
        },
        error: function (error) {
            isUserValid = false;
            invalidMessage.textContent = 'Error: ' + JSON.stringify(error);
            showAlert('Something went wrong.', 'error');
            document.getElementById('checkID').innerText = 'Check';
            disablePaymentButton();
        }
    });
}

document.getElementById('checkID').addEventListener('click', checkApi);

function ClosePayment() {
    const menu = document.getElementById('myModal');
    enablePaymentButton();
    menu.style.display = 'none';
}

const packageBoxes = document.querySelectorAll('.package-box');
packageBoxes.forEach(box => {
    box.addEventListener('click', () => {
        if (isUserValid) {
            packageBoxes.forEach(otherBox => otherBox.classList.remove('selected'));
            box.classList.add('selected');
            selectedPrice = box.getAttribute('data-price');
            selectedDataItem = box.getAttribute('data-item');
            document.getElementById('selectedDataItem').innerText = `${selectedDataItem}`;
            document.getElementById('selectedPrice').innerText = `${selectedPrice}$`;
            document.getElementById('selectedPrice1').innerText = `${selectedPrice}$`;
            showAlert(`${selectedDataItem} Diamonds ${selectedPrice}$`, 'success');
        } else {
            showAlert('Please check your ID before selecting item!', 'error');
            box.classList.remove('selected');
        }
    });
});

function enablePaymentButton() {
    document.getElementById('buyNow').disabled = false;
}

function disablePaymentButton() {
    document.getElementById('buyNow').disabled = true;
}

document.getElementById('buyNow').addEventListener('click', async function () {
    if (!isUserValid) {
        showAlert('You need to verify check ID', 'error');
        return;
    }

    if (!selectedDataItem) {
        showAlert('Please select an item', 'error');
        return;
    }

    document.getElementById('buyNow').innerText = 'Loading...';

    const itemId = selectedDataItem;
    const amount = selectedPrice;
    const userId = document.getElementById('UUID').value;
    const zoneId = document.getElementById('SERVER').value;
    const transactionId = `mlbb${Date.now()}`;

    const menu = document.getElementById('myModal');

    const response = await fetch('/generate-khqr', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ amount, itemId, userId, zoneId, transactionId })
    });

    const result = await response.json();
    if (result.qrCodeData) {
        document.getElementById('qr-code-container').innerHTML = `<img src="${result.qrCodeData}" alt="QR Code">`;
        menu.style.display = 'block';
        document.getElementById('buyNow').innerText = 'Buy Now';
        disablePaymentButton();
    } else {
        document.getElementById('qr-code-container').innerText = 'Failed to generate QR code';
    }
});

const endTime = Date.now() + 20 * 60 * 1000;

// Get the countdown element
const countdownElement = document.getElementById('countdown');

// Update the countdown every second
const countdownInterval = setInterval(function () {
    // Calculate the remaining time
    const currentTime = Date.now();
    const remainingTime = endTime - currentTime;

    // Check if the countdown has ended
    if (remainingTime <= 0) {
        // Redirect to the desired link
        window.location.href = 'https://example.com'; // Replace with your desired URL

        // Clear the interval to stop the countdown
        clearInterval(countdownInterval);
    } else {
        // Update the countdown display
        const minutes = Math.floor(remainingTime / 60000);
        const seconds = Math.floor((remainingTime % 60000) / 1000);

        // Display the countdown in the element
        countdownElement.textContent = ` ${minutes}:${seconds} `;
    }
}, 1000);
