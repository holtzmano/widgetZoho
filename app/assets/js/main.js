let entityId;

ZOHO.embeddedApp.on("PageLoad", async (data) => {
    console.log(data);
    entityId = data.EntityId;
    const entityName = data.Entity;

    ZOHO.CRM.UI.Resize({ height: "50%", width: "20%" });

    try {
        const entityData = await ZOHO.CRM.API.getRecord({
            Entity: entityName,
            approved: "both",
            RecordID: entityId,
            Trigger: ["workflow", "blueprint"]
        });
        console.log(entityData.data);
        const entityDetail = entityData.data[0];

        LoadWidget(entityDetail);

        $("#selectButton").click(() => Submit(entityDetail));
        $("#cancelButton").click(() => ZOHO.CRM.UI.Popup.close());
    } catch (error) {
        console.error('An error occurred:', error);
    }
});

ZOHO.embeddedApp.init();

$(document).ready(() => {
    $('input[type="checkbox"][name="role"]').on('change', function () {
        $('input[type="checkbox"][name="role"]').not(this).prop('checked', false);
    });

    $('#confirmButton').on('click', async () => {
        const selectedRole = $('input[type="checkbox"][name="role"]:checked').val();
        const idInput = $('#idInput').val().trim();
        const passportCheckbox = $('#passportCheckbox').is(':checked');

        if (!selectedRole) {
            swal('Error', 'אנא בחר תפקיד.', 'error');
            return;
        }

        let idValidationResult;
        if (passportCheckbox) {
            console.log("Passport checkbox is checked");
            idValidationResult = isValidPassportId(idInput);
        } else {
            console.log("Passport checkbox is not checked");
            idValidationResult = isValidId(idInput);
        }

        //const idValidationResult = isValidId(idInput);
        if (!idInput || !idValidationResult.valid) {
            swal('Error', idValidationResult.message || 'Please enter an ID.', 'error');
            return;
        }

        try {
            let contact;
            contact = await checkForExistingContact(idInput);

            if (contact) {
                console.log("Existing contact found:", contact);
                console.log("idInput:", idInput); // this is the id of the contact
                let passportCheckbox = $('#passportCheckbox').is(':checked');
                console.log("passportCheckbox:", passportCheckbox);
                let mobile = contact.Mobile;
                console.log("mobile:", mobile);
                const crResponse = await createContactRoleEntry(idInput, selectedRole, contact.Full_Name, passportCheckbox, mobile);
                const contactRoleId = crResponse[0].details.id;
                console.log(`Contact role entry created with ID: ${contactRoleId}`);

                await associateContactRoleWithContact(contactRoleId, contact.id);
                await associateContactRoleWithDeal(contactRoleId, entityId);
            } else {
                console.log("No contact found, showing additional fields.");
                swal("לידיעתך", "לא נמצא ת״ז מזהה במערכת: " + idInput + ". אנא מלא פרטים עבור איש קשר פוטנציאלי חדש זה.", "info");
                showAdditionalInputFields();
                $('#additionalSubmit').off().on('click', async () => {
                    const firstName = $('#firstName').val().trim();
                    const lastName = $('#lastName').val().trim();
                    const phoneNumber = $('#phoneNumber').val().trim();

                    if (!firstName || !lastName || !phoneNumber) {
                        swal('תקלה', 'אנא ספק את פרטי הקשר המלאים.', 'error');
                        return;
                    }

                    const phoneValidationResult = isValidPhoneNumber(phoneNumber);
                    if (!phoneValidationResult.isValid) {
                        swal('תקלה', phoneValidationResult.message, 'error');
                        return;
                    }

                    const nameValidationResult = isValidName(firstName, lastName);
                    if (!nameValidationResult.isValid) {
                        swal('תקלה', nameValidationResult.message, 'error');
                        return;
                    }

                    try {
                        let passportCheckbox = $('#passportCheckbox').is(':checked');
                        console.log("passportCheckbox before entering create contact function:", passportCheckbox);
                        const newContactResponse = await createContactEntry(idInput, { firstName, lastName, phoneNumber }, passportCheckbox);
                        if (newContactResponse && newContactResponse.length > 0) {
                            console.log("newContactResponse:", newContactResponse);
                            const newContactId = newContactResponse[0].details.id;
                            console.log(`New contact created with ID: ${newContactId}`);
                            let passportCheckbox = $('#passportCheckbox').is(':checked');
                            console.log("passportCheckbox:", passportCheckbox);
                            let mobile = $('#phoneNumber').val().trim();
                            console.log("mobile:", mobile);
                            const newCrResponse = await createContactRoleEntry(idInput, selectedRole, `${firstName} ${lastName}`, passportCheckbox, mobile);
                            console.log('Contact role creation response:', newCrResponse);
                            if (newCrResponse && newCrResponse.length > 0) {
                                const newContactRoleId = newCrResponse[0].details.id;
                                console.log(`Contact role entry created with ID: ${newContactRoleId}`);

                                await associateContactRoleWithContact(newContactRoleId, newContactId);
                                await associateContactRoleWithDeal(newContactRoleId, entityId);
                            } else {
                                console.error("Failed to create contact role entry");
                            }
                        } else {
                            console.error("Failed to create contact");
                        }
                    } catch (error) {
                        console.log('An error occurred:', error);
                        swal('Error', 'An error occurred while creating the contact.', 'error');
                    }
                });
            }
        } catch (error) {
            console.error('An error occurred:', error);
        }
    });

    $('#cancelButton').on('click', async () => {
        try {
            await ZOHO.CRM.UI.Popup.close();
            console.log("Popup closed");
        } catch (error) {
            console.error('An error occurred:', error);
        }
    });

    $(document).on('keypress', '#idInput', function (e) {
        if (e.which === 13) {
            console.log("Enter key pressed");
            e.preventDefault(); // Enter key pressed
            $('#confirmButton').click();
        }
    });
});

//--------------------------------------------------------------------------------
function isValidId(id) {
    id = String(id).trim();
    if (id.length > 9) {
        return { valid: false, message: 'תעודת הזהות ארוכה מדי.' };
    }
    if (id.length < 9) {
        return { valid: false, message: 'תעודת הזהות קצרה מדי.' };
    }
    if (isNaN(id)) {
        return { valid: false, message: 'ID should only contain numbers.' };
    }
    id = ('00000000' + id).slice(-9);
    let sum = 0, incNum;
    for (let i = 0; i < 9; i++) {
        incNum = Number(id[i]) * ((i % 2) + 1);
        sum += incNum > 9 ? incNum - 9 : incNum;
    }
    if (sum % 10 !== 0) {
        return { valid: false, message: 'ID is not valid.' };
    }
    return { valid: true };
}
//--------------------------------------------------------------------------------
function isValidPassportId(id) {
    console.log("Original ID:", id);
    id = String(id).trim();  // Ensure input is treated as a string and whitespace trimmed
    console.log("Trimmed ID:", id);

    // Check length constraints
    if (id.length < 1 || id.length > 20) {
        return {
            valid: false,
            message: 'מזהה דרכון חייב להיות באורך של בין 1 ל-20 תווים.'
        };
    }

    // Check character constraints: only alphanumeric characters are allowed
    if (!/^[a-zA-Z0-9]+$/.test(id)) {
        console.log("Character validation failed");
        return {
            valid: false,
            message: 'מזהה דרכון חייב להכיל רק אותיות ומספרים.'
        };
    }

    // If all checks are passed
    console.log("ID is valid");
    return {
        valid: true,
        message: 'Passport ID is valid.'
    };
}
//--------------------------------------------------------------------------------
function isValidPhoneNumber(phoneNumber) {
    // Remove dashes for easier length and digit checks
    const digitsOnly = phoneNumber.replace(/[-+]/g, '');

    // Check for length issues first
    if (digitsOnly.length < 10) {
        return { isValid: false, message: "מספר הטלפון קצר מדי וצריך להכיל בין 10 ל-13 ספרות." };
    } else if (digitsOnly.length > 13) {
        return { isValid: false, message: "מספר הטלפון ארוך מדי וצריך להכיל בין 10 ל-13 ספרות." };
    }

    // Check for non-digit characters
    if (!/^\d+$/.test(digitsOnly)) {
        return { isValid: false, message: "מספר הטלפון מכיל תווים לא חוקיים. רק ספרות ומקפים מותרים." };
    }

    if (!/^\d+$/.test(digitsOnly)) {
        return { isValid: false, message: "מספר הטלפון מכיל תווים לא חוקיים. רק ספרות, מקפים ו+ מותרים." };
    }

    // Validate the format
    const phoneNumberRegex = /^(\+\d{1,3})?(\d{3}-?\d{3}-?\d{4})$/;
    if (!phoneNumberRegex.test(phoneNumber)) {
        return { isValid: false, message: "פורמט מספר טלפון לא חוקי. פורמט נכון: [+קידומת] XXX-XXX-XXXX, מקפים הם אופציונליים." };
    }

    // If all checks pass
    return { isValid: true, message: "מספר הטלפון תקף." };
}
//--------------------------------------------------------------------------------
function isValidName(firstName, lastName) {
    const nameRegex = /^[\u0590-\u05FFa-zA-Z\s]+$/;

    // Check if the first name contains only alphabetic characters
    if (!nameRegex.test(firstName)) {
        return { isValid: false, message: "השם הפרטי מכיל תווים או מספרים לא חוקיים." };
    }

    // Check if the last name contains only alphabetic characters
    if (!nameRegex.test(lastName)) {
        return { isValid: false, message: "שם המשפחה מכיל תווים או מספרים לא חוקיים." };
    }

    // If both names are valid
    return { isValid: true, message: "Names are valid." };
}
//--------------------------------------------------------------------------------
async function checkForExistingContact(id) {
    let func_name = "testFindingIDs";
    console.log("Original ID for CRM check:", id);
    //id = id.toLowerCase();
    console.log("ID sent to CRM function:", id);
    let req_data = {
        arguments: JSON.stringify({ id: id }),
    };
    try {
        let data = await ZOHO.CRM.FUNCTIONS.execute(func_name, req_data);
        console.log("Raw data received from CRM:", data);

        if (data.details.output) {
            console.log("Output before parsing:", data.details.output);
            let contactDetails = JSON.parse(data.details.output);
            console.log("Parsed contact details:", contactDetails);
            console.log("Matching ID found:", contactDetails.Id_No);
            swal('הצלחה', 'איש קשר קיים נמצא במערכת.', 'success');
            return contactDetails;
        } else {
            console.error("No output in data.details to parse:", data.details);
            return null;
        }
    } catch (error) {
        console.error("Error executing custom function:", error);
        swal('Error', 'An error occurred while checking for existing contact.', 'error');
        return null;
    }
}
//--------------------------------------------------------------------------------
async function createContactRoleEntry(id, role, fullName, passportCheckbox, mobile) {
    console.log("entered createContactRoleEntry function");
    //   let passportCheckbox = $('#passportCheckbox').is(':checked');
    console.log("passportCheckbox:", passportCheckbox);
    console.log("mobile:", mobile);
    if (role === "tenant") {
        role = "דייר פוטנציאלי";
    } else if (role === "guarantor") {
        role = "ערב פוטנציאלי";
    }
    var contactRoleData = {
        Entity: 'Contacts_Roles',
        APIData: {
            ID_NO: id,
            Role: role,
            full_name: fullName,
            Passport: passportCheckbox,
            Mobile: mobile
        },
        Trigger: ["workflow", "blueprint"]
    };
    try {
        let response = await ZOHO.CRM.API.insertRecord(contactRoleData);
        console.log("Contact role entry created response:", response);
        return response.data;
    } catch (error) {
        console.log('An error occurred:', error);
        throw error;
    }
}
//--------------------------------------------------------------------------------
async function createContactEntry(id, contactInfo, passportCheckbox) {
    console.log("entered createContactEntry function");
    console.log("passportCheckbox after entering the function:", passportCheckbox);
    var recordData = {
        Id_No: id,
        First_Name: contactInfo.firstName,
        Last_Name: contactInfo.lastName,
        Mobile: contactInfo.phoneNumber,
        Passport: passportCheckbox
        //   Passport: $('#passportCheckbox').is(':checked') ? true : false
    };
    var config = {
        Entity: "Contacts",
        APIData: recordData,
        Trigger: ["workflow", "blueprint"]
    };
    try {
        let response = await ZOHO.CRM.API.insertRecord(config);
        console.log("Contact created:", response.data);
        return response.data;
    } catch (error) {
        console.log('An error occurred:', error);
        if (error.response) {
            console.log('API response:', error.response.data);
        }
        throw error;
    }
}
//--------------------------------------------------------------------------------
function showAdditionalInputFields() {
    $('#confirmButton, #cancelButton').addClass('hidden');

    var fieldsHtml = `
      <div class="input-group">
        <label for="firstName" class="label">שם פרטי:</label>
        <input type="text" id="firstName" name="firstName">
      </div>
      <div class="input-group">
        <label for="lastName" class="label">שם משפחה:</label>
        <input type="text" id="lastName" name="lastName">
      </div>
      <div class="input-group">
        <label for="phoneNumber" class="label">נייד:</label>
        <input type="text" id="phoneNumber" name="phoneNumber">
      </div>
      <div class="button-group">
        <button type="button" class="button button-primary" id="additionalSubmit">אישור</button>
        <button type="button" class="button button-secondary" id="dynamicCancelButton">ביטול</button>
      </div>
    `;
    $('#role-selection-form').append(fieldsHtml);

    $('#dynamicCancelButton').on('click', () => {
        try {
            ZOHO.CRM.UI.Popup.close().then(() => {
                console.log("Popup closed");
            });
        } catch (error) {
            console.error('An error occurred:', error);
        }
    });
}
//--------------------------------------------------------------------------------
async function associateContactRoleWithContact(contactRoleId, contactId) {
    var config = {
        Entity: "Contacts_Roles",
        RecordID: contactRoleId,
        APIData: {
            "id": contactRoleId,
            "Contact": contactId
        },
        Trigger: ["workflow", "blueprint"]
    };
    try {
        let response = await ZOHO.CRM.API.updateRecord(config);
        console.log("Contact Role associated with Contact:", response.data);
        return response.data;
    } catch (error) {
        console.error("Failed to associate Contact Role with Contact:", error);
        throw error;
    }
}
//--------------------------------------------------------------------------------
async function associateContactRoleWithDeal(contactRoleId, dealId) {
    try {
        const stringDealId = dealId.toString();
        let response = await ZOHO.CRM.API.updateRecord({
            Entity: "Contacts_Roles",
            RecordID: contactRoleId,
            APIData: {
                "id": contactRoleId,
                "Deal": stringDealId
            }
        });
        console.log("Contact Role associated with Deal:", response.data);
        swal('הצלחה', 'נוצר תפקיד איש קשר הקשור לעסקה ולאיש קשר.', 'success')
            .then(() => {
                ZOHO.CRM.UI.Popup.closeReload();
            });
    } catch (error) {
        console.error("Failed to associate Contact Role with Deal:", error);
        throw error;
    }
}



/*
lowercaseId = id.toLowerCase();
uppercaseId = id.toUpperCase();
lowerMatchingId = zoho.crm.searchRecords("Contacts","(Id_No:equals:" + lowercaseId + ")");
if ( lowerMatchingId == null ) 
{
    upperMatchingId = zoho.crm.searchRecords("Contacts","(Id_No:equals:" + uppercaseId + ")");
}
info matchingId.size();
info matchingId;
return matchingId;
*/