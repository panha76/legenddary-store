<?php
if ($_SERVER["REQUEST_METHOD"] == "POST") {
    $username = $_POST["username"];
    $amount = $_POST["amount"];
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">

    <script src="https://github.com/davidhuotkeo/bakong-khqr/releases/download/bakong-khqr-1.0.6/khqr-1.0.6.min.js"></script>
</head>
<body>

    <script>
        document.addEventListener("DOMContentLoaded", function () {
            const { BakongKHQR, khqrData, MerchantInfo } = window.BakongKHQR;

            const merchantInfo = {
                bakongAccountID: "youtcheng2024@aclb",
                merchantName: "Yout Cheng",
                merchantCity: "Phnom Penh",
                merchantId: "007168",
                acquiringBank: "Bakong Bank",
            };

            // Get amount and user from PHP POST request
            const amount = <?php echo isset($_POST['amount']) ? floatval($_POST['amount']) : 0.1; ?>;
            const user = '<?php echo isset($_POST['username']) ? $_POST['username'] : 'defaultUser'; ?>';

            const optionalData = {
                currency: khqrData.currency.usd,
                amount: amount,
                mobileNumber: "85515412754",
                billNumber: generateBillNumber(),
                storeLabel: "WWW.KHSMM.NET",
                terminalLabel: "012345",
            };

            function generateBillNumber() {
                return "INV-" + new Date().toISOString().replace(/[-:.TZ]/g, "");
            }

            const merchantInfoInstance = new MerchantInfo(
                merchantInfo.bakongAccountID,
                merchantInfo.merchantName,
                merchantInfo.merchantCity,
                merchantInfo.merchantId,
                merchantInfo.acquiringBank,
                optionalData
            );

            const khqr = new BakongKHQR();
            const response = khqr.generateMerchant(merchantInfoInstance);

            // Redirect to the specified URL with md5, amount, and user
            const redirectUrl = `check.php?md5=${response.data.md5}&amount=${amount}&qr=${response.data.qr}&userid=${user}`;
            window.location.href = redirectUrl;
        });
    </script>
</body>
</html>

<?php
} else {
    // Handle the case where the form wasn't submitted properly
    echo "Form not submitted.";
}
?>
