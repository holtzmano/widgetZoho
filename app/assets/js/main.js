let entityId;

let gptResponseObject = {
    "status": "success",
    "data": {
        "id": "209905207",
        "firstName": "John",
        "lastName": "Doe",
        "DOB": "1990-01-01"
    }
};

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

    let processing = false; // Guard variable

    $('#confirmButton').on('click', async () => {
        if (processing) {
            console.log('Action already in progress. Ignoring subsequent click.');
            return; // Ignore this click if already processing
        }
        processing = true; // Lock further actions

        const $confirmButton = $('#confirmButton');
        console.log('Before disabling, is confirmButton disabled?', $confirmButton.prop('disabled'));
        $confirmButton.prop('disabled', true);
        console.log('After disabling, is confirmButton disabled?', $confirmButton.prop('disabled'));

        try {
            const selectedRole = $('input[type="checkbox"][name="role"]:checked').val();
            let idInput = $('#idInput').val().trim();
            const passportCheckbox = $('#passportCheckbox').is(':checked');
            const idFile = $('#idFile')[0].files[0];

            if (!selectedRole) {
                swal('Error', 'אנא בחר תפקיד.', 'error');
                return;
            }

            if (!idInput && idFile) {
                // Fetch gptResponseObject from the file
                idInput = gptResponseObject.data.id;
                console.log("ID from GPT response:", idInput);
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

                    // Update DOB if contact is found
                    const updateDOBResponse = await updateContactDOB(contact.id, gptResponseObject.data.DOB);
                    console.log("DOB updated:", updateDOBResponse);

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

                    // Guard variable for preventing duplicate submissions
                    let processingContactCreation = false;

                    $('#additionalSubmit').off().on('click', async () => {
                        if (processingContactCreation) {
                            console.log('Action already in progress. Ignoring subsequent click.');
                            return; // Ignore this click if already processing
                        }

                        processingContactCreation = true; // Lock further actions

                        const $additionalSubmitButton = $('#additionalSubmit');
                        $additionalSubmitButton.prop('disabled', true);

                        try {
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
                                const fullName = combineFullName(firstName, lastName);
                                console.log("Full Name:", fullName);

                                const newContactResponse = await createContactEntry(idInput, { firstName, lastName, phoneNumber }, passportCheckbox);
                                
                                if (newContactResponse && newContactResponse.length > 0) {
                                    console.log("newContactResponse:", newContactResponse);
                                    const newContactId = newContactResponse[0].details.id;
                                    console.log(`New contact created with ID: ${newContactId}`);
                                    let passportCheckbox = $('#passportCheckbox').is(':checked');
                                    console.log("passportCheckbox:", passportCheckbox);
                                    let mobile = $('#phoneNumber').val().trim();
                                    console.log("mobile:", mobile);
                                    const newCrResponse = await createContactRoleEntry(idInput, selectedRole, fullName, passportCheckbox, mobile);
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
                        } catch (error) {
                            console.error('An error occurred:', error);
                        } finally {
                            console.log('Re-enabling additionalSubmitButton.');
                            $additionalSubmitButton.prop('disabled', false);
                            processingContactCreation = false; // Release the lock
                        }
                    });
                }
            } catch (error) {
                console.error('An error occurred:', error);
            }

        } catch (error) {
            console.error('An error occurred:', error);
        } finally {
            // Re-enable the confirm button after the operation completes
            console.log('Re-enabling confirmButton.');
            $confirmButton.prop('disabled', false);
            processing = false; // Release the lock
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
async function updateContactDOB(contactId, dob) {
    const formattedDOB = getISOFormattedDate(new Date(dob));
    console.log("Formatted DOB:", formattedDOB);
    const config = {
        Entity: "Contacts",
        RecordID: contactId,
        APIData: {
            id: contactId,
            Date_of_Birth: formattedDOB
        },
        Trigger: ["workflow", "blueprint"]
    };
    try {
        let response = await ZOHO.CRM.API.updateRecord(config);
        console.log("Contact DOB updated:", response.data);
        return response.data;
    } catch (error) {
        console.error("Failed to update contact DOB:", error);
        throw error;
    }
}
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
async function createContactRoleEntry(id, role, fullName, passportCheckbox, mobile, contactId) {
    console.log("entered createContactRoleEntry function");
    console.log("passportCheckbox:", passportCheckbox);
    console.log("mobile:", mobile);
    console.log("Full Name before validation:", fullName);

    // Ensure the full name includes a space between first and last name
    if (!fullName.includes(" ")) {
        fullName = fullName.replace(/([a-z])([A-Z])/g, '$1 $2'); // Adds space between camelCase names
        console.log("Full Name after adding space:", fullName);
    }

    if (role === "tenant") {
        role = "דייר פוטנציאלי";
    } else if (role === "guarantor") {
        role = "ערב פוטנציאלי";
    }

    let contactData = await ZOHO.CRM.API.getRecord({
        Entity: "Contacts",
        RecordID: contactId
    });

    console.log("Contact data: ", contactData.data);
    let folder = contactData.data[0].folder;
    console.log("Folder: ", folder);

    // Create a log entry
    const logDetails = `
        ID: ${id}
        Role: ${role}
        Full Name: ${fullName}
        Passport Checkbox: ${passportCheckbox}
        Mobile: ${mobile}
        Folder: ${folder}
        Contact ID: ${contactId}
        Timestamp: ${new Date().toISOString()}
    `;

    var contactRoleData = {
        Entity: 'Contacts_Roles',
        APIData: {
            ID_NO: id,
            Role: role,
            full_name: fullName,
            Passport: passportCheckbox,
            Mobile: mobile,
            Folder: folder,
            Log_Details: logDetails
        },
        Trigger: ["workflow", "blueprint"]
    };
    console.log("logDetails:", logDetails);
    try {
        let response = await ZOHO.CRM.API.insertRecord(contactRoleData);
        console.log("Contact role entry created response:", response);
        return response.data;
    } catch (error) {
        console.log('An error occurred:', error);
        throw error;
    }
}
//--------------------------------------------------------------------------------//
async function createContactEntry(id, contactInfo, passportCheckbox) {
    const formattedDOB = getISOFormattedDate(new Date(gptResponseObject.data.DOB));
    console.log("entered createContactEntry function");
    console.log("passportCheckbox after entering the function:", passportCheckbox);
    var recordData = {
        Id_No: id,
        First_Name: contactInfo.firstName,
        Last_Name: contactInfo.lastName,
        Mobile: contactInfo.phoneNumber,
        Passport: passportCheckbox,
        Date_of_Birth: formattedDOB
        //   Passport: $('#passportCheckbox').is(':checked') ? true : false
    };

    // Ensure the full name is properly formatted
    recordData.Full_Name = `${contactInfo.firstName} ${contactInfo.lastName}`;
    console.log("Full Name:", recordData.Full_Name);

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
// Additional function to ensure first and last names are combined correctly
function combineFullName(firstName, lastName) {
    if (!firstName || !lastName) {
        throw new Error("First name or last name is missing");
    }
    return `${firstName.trim()} ${lastName.trim()}`;
}
//--------------------------------------------------------------------------------
function showAdditionalInputFields() {
    $('#confirmButton, #cancelButton').addClass('hidden');

    const idInput = $('#idInput').val().trim();
    const firstNameValue = idInput === '' ? gptResponseObject.data.firstName : '';
    const lastNameValue = idInput === '' ? gptResponseObject.data.lastName : '';

    var fieldsHtml = `
      <div class="input-group">
        <label for="firstName" class="label">שם פרטי:</label>
        <input type="text" id="firstName" name="firstName" value="${firstNameValue}">
      </div>
      <div class="input-group">
        <label for="lastName" class="label">שם משפחה:</label>
        <input type="text" id="lastName" name="lastName" value="${lastNameValue}">
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
//--------------------------------------------------------------------------------
const getISOFormattedDate = (date) => {
    const year = date.getFullYear();
    const month = ('0' + (date.getMonth() + 1)).slice(-2); // Add leading zero
    const day = ('0' + date.getDate()).slice(-2); // Add leading zero
    return `${year}-${month}-${day}`;
};

