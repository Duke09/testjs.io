/**
 *  Shopify Thankyou page checks for phone & pincode
 */

(function () {
    var checkoutObj
    var shop = window.Shopify.shop
    if (window.Shopify && window.Shopify.checkout) {
        checkoutObj = window.Shopify.checkout
    } else {
        var orderId = getParameterByName('order_id')
        checkoutObj = { orderId: orderId, detailsNa: true }
    }
    var baseUrl = '@@baseUrl';
    var contactInfoChecks;

    function getParameterByName(name) {
        var match = RegExp('[?&]' + name + '=([^&]*)').exec(window.location.search);
        return match && decodeURIComponent(match[1].replace(/\+/g, ' '));
    }

    function checkIfIndianOrder() {
        if (!checkoutObj.shipping_address) {
            return false
        }
        return checkoutObj.shipping_address.country === 'India'
    }

    function checkContactInfo() {
        var http = new XMLHttpRequest();
        var apiRequest = checkoutObj;
        apiRequest.shop = shop;
        var url = baseUrl + '/api/order_analysis/contact_info/';
        http.onreadystatechange = function () {
            if (this.readyState == 4 && this.status == 200) {
                var response = JSON.parse(this.responseText).data;
                var phoneCheck = extractPhoneNumber(checkoutObj.shipping_address.phone)
                fixPincode = response.order_confirmation_pincode_check_enabled && !response.pincode_valid;
                fixPhone = response.order_confirmation_phone_check_enabled && !response.phone_valid && phoneCheck.requestPhone;
                if (fixPincode || fixPhone) {
                    contactInfoChecks = {
                        fixPincode: fixPincode,
                        fixPhone: fixPhone,
                        validState: response.valid_state
                    }
                    showContactInfoPopup()
                }
            }
        };
        http.open('POST', url, true);
        http.setRequestHeader('Content-type', 'application/json');
        http.send(JSON.stringify(apiRequest));
    }

    function showContactInfoPopup() {
        contactInfoChecks.formDOM = document.getElementById('lgs-contact-form');
        if (contactInfoChecks.fixPhone) {
            var phoneObj = extractPhoneNumber(checkoutObj.shipping_address.phone)
            var phoneForm = document.getElementById('lgs-phone-cont')
            phoneForm.style.display = 'block'
            contactInfoChecks.phoneInput = document.getElementById('lgs-phone-input')
            contactInfoChecks.phoneInput.value = phoneObj.defaultValue;
            contactInfoChecks.phoneInput.addEventListener('keyup', validatePhone)
            contactInfoChecks.phoneErrorDOM = document.getElementsByClassName('lgs-error-msg')[0]
            validatePhone()
        }
        if (contactInfoChecks.fixPincode) {
            var pincodeForm = document.getElementById('lgs-pincode-cont')
            pincodeForm.style.display = 'block'
            document.getElementById('lgs-pin-code-1').innerHTML = checkoutObj.shipping_address.zip;
            document.getElementById('lgs-pin-code-2').innerHTML = checkoutObj.shipping_address.zip;
            document.getElementById('lgs-state-name').innerHTML = checkoutObj.shipping_address.province;
            contactInfoChecks.pincodeConfirm = document.getElementsByClassName('lgs-pincode-confirm')
            contactInfoChecks.pincodeInput = document.getElementById('lgs-pincode-input')
            contactInfoChecks.pincodeInputForm = document.getElementById('lgs-pincode-input-form')
            for (var i = 0; i < contactInfoChecks.pincodeConfirm.length; i++) {
                contactInfoChecks.pincodeConfirm[i].addEventListener('change', validatePincodeConfirm)
            }
            contactInfoChecks.pincodeConfirmErrorDOM = document.getElementById('lgs-pincode-confirm-error')
            contactInfoChecks.pincodeErrorDOM = document.getElementById('lgs-pincode-error')
        }
        if (contactInfoChecks.fixPincode || contactInfoChecks.fixPhone) {
            document.getElementById('lgs-popup-overlay').style.display = 'block'
        }
        document.getElementById('lgs-form-submit').addEventListener('click', submitContactInfoForm)

    }

    function togglePincodeInput(e) {
        var formData = new FormData(document.getElementById('lgs-contact-form'))
        var value = formData.get('lgs_pincode_confirm');
        if (value === 'no') {
            contactInfoChecks.pincodeInputForm.style.display = 'block';
            contactInfoChecks.pincodeInput.addEventListener('keyup', validatePincode)
        } else {
            contactInfoChecks.pincodeInputForm.style.display = 'none';
            contactInfoChecks.pincodeInput.removeEventListener('keyup', validatePincode)
        }
    }

    function validatePhone(e) {
        if (contactInfoChecks.fixPhone) {
            var value = contactInfoChecks.phoneInput.value;
            var phoneRegex = /^(0091|\+0091|\+91|0|\+0|\+)?([6-9]{1}[0-9]{9})$/
            if (!phoneRegex.test(value)) {
                contactInfoChecks.phoneError = true
                contactInfoChecks.phoneErrorDOM.style.display = 'block'
            } else {
                contactInfoChecks.phoneErrorDOM.style.display = 'none'
                contactInfoChecks.phoneError = false
            }
        }
    }

    function validatePincodeConfirm() {
        if (contactInfoChecks.fixPincode) {
            var formData = new FormData(document.getElementById('lgs-contact-form'))
            if (!formData.get('lgs_pincode_confirm')) {
                contactInfoChecks.pincodeConfirmError = true
                contactInfoChecks.pincodeConfirmErrorDOM.style.display = 'block'
            } else {
                togglePincodeInput()
                contactInfoChecks.pincodeConfirmError = false
                contactInfoChecks.pincodeConfirmErrorDOM.style.display = 'none'
            }
        }
    }

    function validatePincode() {
        if (contactInfoChecks.fixPincode) {
            var value = contactInfoChecks.pincodeInput.value;
            var pincodeRegex = /^[1-9]{1}[0-9]{5}$/
            if (!pincodeRegex.test(value)) {
                contactInfoChecks.pincodeError = true
                contactInfoChecks.pincodeErrorDOM.style.display = 'block'
            } else {
                contactInfoChecks.pincodeErrorDOM.style.display = 'none'
                contactInfoChecks.pincodeError = false
            }
        }
    }

    function submitContactInfoForm(e) {
        e.preventDefault();
        validatePhone();
        validatePincodeConfirm();
        validatePincode();
        var formData = new FormData(document.getElementById('lgs-contact-form'))
        if (contactInfoChecks.fixPhone && contactInfoChecks.phoneError) {
            return
        } else if (contactInfoChecks.fixPincode && contactInfoChecks.pincodeConfirmError) {
            return
        } else if (formData.lgs_pincode_confirm === 'no' && contactInfoChecks.pincodeError) {
            return
        } else {
            var http = new XMLHttpRequest();
            var apiRequest = {
                shop: shop,
                order_id: checkoutObj.order_id,
                pincode: contactInfoChecks.fixPincode && formData.get('lgs_pincode_confirm') === 'no' ? formData.get('lgs_pincode') : undefined,
                state: contactInfoChecks.fixPincode && formData.get('lgs_pincode_confirm') === 'yes' ? contactInfoChecks.validState : undefined,
                phone_number: contactInfoChecks.fixPhone ? formData.get('lgs_phone') : undefined
            };
            http.onreadystatechange = function () {
                if (this.readyState == 4 && this.status == 200) {
                    document.getElementById('lgs-contact-form').style.display = 'none'
                    document.getElementById('lgs-thanks-msg').style.display = 'block'
                    document.getElementById('lgs-form-close').addEventListener('click', hideContactPopup)
                }
            }
            var url = baseUrl + '/api/order_analysis/corrected_info/';
            http.open('POST', url, true);
            http.setRequestHeader('Content-type', 'application/json');
            http.send(JSON.stringify(apiRequest));
        }
    }

    function hideContactPopup() {
        document.getElementById('lgs-popup-overlay').style.display = 'none'
    }

    function extractPhoneNumber(phoneStr) {
        phoneStr = phoneStr.replace(/\(|\)|\.|\-|\s/g, '');
        phoneArr = phoneStr.split(/,|\||\/|\\/g);
        correctPhoneArr = [];
        phoneRegex = /^(0091|\+0091|\+91|0|\+0|\+)?([6-9]{1}[0-9]{9})$/
        for (var i = 0; i < phoneArr.length; i++) {
            if (phoneRegex.test(phoneArr[i])) {
                correctPhoneArr.push(phoneArr[i])
            }
        }
        extractDigitsRegex = /^(0091|\+0091|\+91|0|\+0|\+)?([0-9]*)$/
        return {
            requestPhone: !correctPhoneArr.length,
            defaultValue: phoneArr.length ? phoneArr[0].match(extractDigitsRegex)[2] : ''
        }
    }

    function prependZero(value) {
        if (value < 10) {
            return '0' + value;
        }
        return value;
    }

    var contactCorrectPopup = "<style>body{font-family:sans-serif}.lgs-popup-overlay{display:none;position:fixed;top:0;left:0;right:0;bottom:0;background-color:rgba(0,0,0,0.2);color:#545454;font-size:14px;z-index:1000}.lgs-popup-content{width:360px;padding:30px;position:absolute;top:50%;left:50%;-webkit-transform:translate(-50%,-50%);-moz-transform:translate(-50%,-50%);-o-transform:translate(-50%,-50%);-ms-transform:translate(-50%,-50%);transform:translate(-50%,-50%);background-color:rgba(255,255,255);border-radius:4px;max-width:300px}#lgs-contact-form{margin-bottom:0}.lgs-title{font-size:20px;font-weight:500;margin-bottom:15px}.lgs-primary-button{background-color:#23314e;color:#fff;border:none;padding:10px;width:120px;border-radius:3px;font-weight:500;font-size:12px}.lgs-secondary-button{border:1px solid rgba(0,0,0,0.5)}.lgs-intro{margin-bottom:10px;font-size:14px}.lgs-label{color:#737373;font-size:12px;margin-bottom:6px}.form-row{margin-bottom:20px}.lgs-error-msg{color:#f00;font-size:10px;margin-top:3px;display:none}.lgs-input{padding:8px;border-radius:3px;border:1px solid #cecece}.radio-label{display:block;margin-bottom:5px}.lgs-pincode-confirm{-webkit-appearance:radio;-moz-appearance:radio;appearance:radio}.btn-container{overflow:hidden}.btn-container .lgs-primary-button{float:right}.lgs-thanks-text{margin-bottom:30px}#lgs-pincode-cont,#lgs-pincode-input-form,#lgs-phone-cont,#lgs-thanks-msg{display:none}</style><div class='lgs-popup-overlay' id='lgs-popup-overlay'><div class='lgs-popup-content'><form id='lgs-contact-form' novalidate><div class='lgs-title'>Update shipping details</div><div class='lgs-intro'>Incorrect shipping details found! Please correct your details to assist delivery.</div><div class='form-row' id='lgs-phone-cont'><div class='lgs-label'>Enter 10 digit mobile number</div><div class='lgs-phone-no-container'> <span>+91</span> <input id='lgs-phone-input' name='lgs_phone' class='lgs-input' required type='number'></input></div><div class='lgs-error-msg' id='lgs-phone-error'>Please enter a valid mobile number</div></div><div id='lgs-pincode-cont'><div class='form-row'><div class='lgs-label'>The pincode provided(<span id='lgs-pin-code-1'></span>) is not a part of <span id='lgs-state-name'></span>. Is <span id='lgs-pin-code-2'></span> the correct pincode?</div><div class='lgs-pincode-no-container'> <label class='radio-label'><input class='lgs-pincode-confirm' type='radio' name='lgs_pincode_confirm' value='no'> No, i want to update pincode</label> <label class='radio-label'><input class='lgs-pincode-confirm' type='radio' name='lgs_pincode_confirm' value='yes'> Yes, pincode is correct. Update the state</label></div><div class='lgs-error-msg' id='lgs-pincode-confirm-error'>Please select an option</div></div><div class='form-row' id='lgs-pincode-input-form'><div class='lgs-label'>Enter correct pincode</div> <input required type='number' name='lgs_pincode' class='lgs-input' id='lgs-pincode-input'></input><div class='lgs-error-msg' id='lgs-pincode-error'>Please enter a valid pin code</div></div></div><div class='btn-container'> <button id='lgs-form-submit' class='lgs-primary-button'>Done</button></div></form><div id='lgs-thanks-msg'><div class='lgs-title'>Thank you</div><div class='lgs-intro lgs-thanks-text'>We have received your corrected information. Your shipping details will be updated.</div><div class='btn-container'> <button id='lgs-form-close' class='lgs-primary-button'>Close</button></div></div></div></div>"
    // document.body.innerHTML += contactCorrectPopup;
    document.body.insertAdjacentHTML('beforeend', contactCorrectPopup)

    
    // Send Pixelids
    function getCookieByName(cname) {
        var name = cname + "=";
        var decodedCookie = decodeURIComponent(document.cookie);
        var ca = decodedCookie.split(';');
        for (var i = 0; i < ca.length; i++) {
          var c = ca[i];
          while (c.charAt(0) == ' ') {
            c = c.substring(1);
          }
          if (c.indexOf(name) == 0) {
            return c.substring(name.length, c.length);
          }
        }
        return "";
    }
    
    function getParameterByName(name, url) {
        if (!url) url = window.location.href;
        name = name.replace(/[\[\]]/g, '\\$&');
        var regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)'),
        results = regex.exec(url);
        if (!results) return null;
        if (!results[2]) return '';
        return decodeURIComponent(results[2].replace(/\+/g, ' '));
    }

    var fbp = getCookieByName('_fbp');
    var fbclid = getParameterByName('fbclid', window.location.href);

    fbclid = fbclid ? fbclid : '';
    
    const data = { 'fbp': fbp, 'fbclid': fbclid, 'order_id': {{ order.id }}, 'store_name': {{ shop.name }} };
    
    function offlineConversion(data){
        var url = 'https://test.logisy.in/api/orders/facebook/offline-conversion/';
        console.log(data)
        console.log(url)

        // fetch(url, {
        //     method: "POST",
        //     headers: {
        //         "Content-Type": "application/json",
        //     },
        //     body: JSON.stringify(data),
        // }).then(response => {
        //     console.log("Response : ", response);
        // }).catch((error) => {
        //     console.log('Error:', error);
        // });
    }

    // Show cod convert offer
    setTimeout(function () {
        // Validate user number and pincode
        if (!checkoutObj.detailsNa && checkIfIndianOrder() && (Date.now() - (new Date(checkoutObj.created_at)).getTime()) < 12 * 60 * 60 * 1000) {
            checkContactInfo()
        }
        offlineConversion(data)
    }, 0)

})()
