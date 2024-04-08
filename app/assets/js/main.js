let entityId;

ZOHO.embeddedApp.on("PageLoad", async (data) => {
    console.log(data);
    entityId = data.EntityId;
    const entityName = data.Entity;

    ZOHO.CRM.UI.Resize({ height: "600", width: "800" });

    try {
        const entityData = await ZOHO.CRM.API.getRecord({
            Entity: entityName,
            approved: "both",
            RecordID: entityId,
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
    $('input[type="checkbox"][name="role"]').on('change', function() {
        $('input[type="checkbox"][name="role"]').not(this).prop('checked', false);
    });

    $('#confirmButton').on('click', async () => {
        const selectedRole = $('input[type="checkbox"][name="role"]:checked').val();
        const idInput = $('#idInput').val().trim();

        if (!selectedRole) {
            swal('Error', 'Please select a role.', 'error');
            return;
        }

        const idValidationResult = isValidId(idInput);
        if (!idInput || !idValidationResult.valid) {
            swal('Error', idValidationResult.message || 'Please enter an ID.', 'error');
            return;
        }

        try {
            const contact = await checkForExistingContact(idInput);
            if (contact) {
                console.log("Existing contact found:", contact);
                console.log("idInput:", idInput); // this is the id of the contact
                const crResponse = await createContactRoleEntry(idInput, selectedRole, contact.Full_Name);
                const contactRoleId = crResponse[0].details.id;
                console.log(`Contact role entry created with ID: ${contactRoleId}`);

                await associateContactRoleWithContact(contactRoleId, contact.id);
                await associateContactRoleWithDeal(contactRoleId, entityId);
            } else {
                console.log("No contact found, showing additional fields.");
                showAdditionalInputFields();
                $('#additionalSubmit').off().on('click', async () => {
                    const firstName = $('#firstName').val().trim();
                    const lastName = $('#lastName').val().trim();
                    const phoneNumber = $('#phoneNumber').val().trim();

                    if (!firstName || !lastName || !phoneNumber) {
                        swal('Error', 'Please provide the full contact details.', 'error');
                        return;
                    }

                    try {
                        const newContactResponse = await createContactEntry(idInput, { firstName, lastName, phoneNumber });
                        if (newContactResponse && newContactResponse.length > 0){
                          console.log("newContactResponse:", newContactResponse);
                          const newContactId = newContactResponse[0].details.id;
                          console.log(`New contact created with ID: ${newContactId}`);

                          const newCrResponse = await createContactRoleEntry(idInput, selectedRole, `${firstName} ${lastName}`);
                          console.log('Contact role creation response:', newCrResponse);
                          if (newCrResponse && newCrResponse.length > 0){
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
});

//--------------------------------------------------------------------------------
function isValidId(id) {
  id = String(id).trim();
  if (id.length > 9) { return { valid: false, message: 'ID is too long.' };
  }
  if (id.length < 9) { return { valid: false, message: 'ID is too short.' };
  }
  if (isNaN(id)) { return { valid: false, message: 'ID should only contain numbers.' };
  }
  id = ('00000000' + id).slice(-9);
  let sum = 0, incNum;
  for (let i = 0; i < 9; i++) {
      incNum = Number(id[i]) * ((i % 2) + 1);
      sum += incNum > 9 ? incNum - 9 : incNum;
  }
  if (sum % 10 !== 0) { return { valid: false, message: 'ID is not valid.' };
  }
  return { valid: true };
}
//--------------------------------------------------------------------------------
async function checkForExistingContact(id) {
  let func_name = "testFindingIDs";
  let req_data = {
      arguments: JSON.stringify({ id: id }),
  };
  try {
      let data = await ZOHO.CRM.FUNCTIONS.execute(func_name, req_data);
      if (data.details.output) {
          let contactDetails = JSON.parse(data.details.output);
          console.log("Parsed contact details:", contactDetails);
          if (contactDetails.Id_No && contactDetails.Id_No === id) {
              console.log("Matching ID found:", contactDetails.Id_No);
              return contactDetails;
          } else {
              console.log("No matching ID found for:", id);
              return null;
          }
      } else {
          console.error("No output in data.details to parse:", data.details);
          return null;
      }
  } catch (error) {
      console.error("Error executing custom function:", error);
      return null;
  }
}
//--------------------------------------------------------------------------------
async function createContactRoleEntry(id, role, fullName) {
  console.log("entered createContactRoleEntry function");
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
async function createContactEntry(id, contactInfo) {
  console.log("entered createContactEntry function");
  var recordData = {
      Id_No: id,
      First_Name: contactInfo.firstName,
      Last_Name: contactInfo.lastName,
      Mobile: contactInfo.phoneNumber,
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
  var fieldsHtml = `
    <div class="input-group"><label for="firstName">First Name:</label><input type="text" id="firstName" name="firstName"></div>
    <div class="input-group"><label for="lastName">Last Name:</label><input type="text" id="lastName" name="lastName"></div>
    <div class="input-group"><label for="phoneNumber">Phone Number:</label><input type="text" id="phoneNumber" name="phoneNumber"></div>
    <button id="additionalSubmit">Submit</button>
  `;
  $('#role-selection-form').append(fieldsHtml);
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
      Trigger: ["workflow"]
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
  } catch (error) {
      console.error("Failed to associate Contact Role with Deal:", error);
      throw error;
  }
}








// let entityId;
// ZOHO.embeddedApp.on("PageLoad", function (data) {
//   console.log(data);
//   console.log(data.EntityId);
//   console.log(data.Entity);
//   entityId = data.EntityId;
//   let entityName = data.Entity;

//   ZOHO.CRM.UI.Resize({ height: "600", width: "800" });
//     ZOHO.CRM.API.getRecord({
//       Entity: entityName,
//       approved: "both",
//       RecordID: entityId,
//     }).then(function (entityData) {
//       console.log(entityData.data);
//       let entityDetail = entityData.data[0];
//       //
//       LoadWidget(entityDetail);

//       $("#selectButton").click(function () {
//         Submit(entityDetail);
//       });

//       $("#cancelButton").click(function () {
//         ZOHO.CRM.UI.Popup.close();
//       });
//     }).catch(function(error) {
//       console.error('An error occurred:', error);
//     });
//   });

// ZOHO.embeddedApp.init();

// $(document).ready(function() {
//   // Ensure only one checkbox can be selected at a time
//   $('input[type="checkbox"][name="role"]').on('change', function() {
//       $('input[type="checkbox"][name="role"]').not(this).prop('checked', false);
//   });

//   // Handle the confirm button click with validation
//   $('#confirmButton').on('click', function() {
//       var selectedRole = $('input[type="checkbox"][name="role"]:checked').val();
//       var idInput = $('#idInput').val().trim();

//       // Perform basic validation
//       if (!selectedRole) {
//           swal('Error', 'Please select a role.', 'error');
//           return;
//       }
//       var idValidationResult = isValidId(idInput);
//       if (!idInput || !idValidationResult.valid) {
//           swal('Error', idValidationResult.message || 'Please enter an ID.', 'error');
//           return;
//       }

//       checkForExistingContact(idInput)
//       .then(function(contact) {
//         if (contact) {
//           console.log("Existing contact found:", contact);
//           // If contact exists, proceed with role creation and association
//           // let contact = response.data[0];
//           // Create Contact Role entry and associate it
//           createContactRoleEntry(idInput, selectedRole, contact.Full_Name).then(function(crResponse) {
//             let contactRoleId = crResponse[0].details.id;
//             console.log(`Contact role entry created with ID: ${contactRoleId}`);
//             console.log("Contact ID:", contact.id);
//             associateContactRoleWithContact(contactRoleId, contact.id);
//             entityId = entityId[0];
//             console.log("Entity ID:", entityId);
//             associateContactRoleWithDeal(contactRoleId, entityId);
//           });
//         } else {
//           console.log("Entered the else because no contact was found.");
//           // No contact found logic here, including showing additional fields
//           showAdditionalInputFields();
//           $('#additionalSubmit').off().on('click', function() { // Ensure not to bind multiple times
//             var firstName = $('#firstName').val().trim();
//             var lastName = $('#lastName').val().trim();
//             var phoneNumber = $('#phoneNumber').val().trim();
        
//             if (!firstName || !lastName || !phoneNumber) {
//                 swal('Error', 'Please provide the full contact details.', 'error');
//                 return;
//             }

//             console.log('Attempting to create contact entry');
//             createContactEntry(idInput, {firstName, lastName, phoneNumber}).then(function(newContactResponse) {
//               console.log('Contact creation response:', newContactResponse);
//               let newContactId = newContactResponse[0].details.id; // i think i need the real id
//               let fullName = `${firstName} ${lastName}`;
//               console.log(`Creating contact role entry for ID: ${newContactId}`);
//               createContactRoleEntry(idInput, selectedRole, fullName);// this might need to be id input
//             })
//             .then(function(newCrResponse) {
//                 console.log('Contact role creation response:', newCrResponse);
//                 let newContactRoleId = newCrResponse[0].details.id;
//                 console.log(`Contact role entry created with ID: ${newContactRoleId}`);
//                 associateContactRoleWithContact(newContactRoleId, newContactId);
//                 associateContactRoleWithDeal(newContactRoleId, entityId);
//               })
//               .catch(function(error) {
//                 console.error('An error occurred:', error)
//               });
//           });
//         }
//       })
//       .catch(function(error) {
//         console.error('An error occurred:', error);
//       });

//       console.log("Selected role:", selectedRole, "ID:", idInput);
//   });
//   $('#cancelButton').on('click', function() {
//     ZOHO.CRM.UI.Popup.close().then(function() {
//         console.log("Popup closed");
//     }).catch(function(error) {
//         console.error('An error occurred:', error);
//     });
//   });
// });

// //--------------------------------------------------------------------------------
// function isValidId(id) {
//   id = String(id).trim();
//   if (id.length > 9) { return { valid: false, message: 'ID is too long.' };
//   }
//   if (id.length < 9) { return { valid: false, message: 'ID is too short.' };
//   }
//   if (isNaN(id)) { return { valid: false, message: 'ID should only contain numbers.' };
//   }
//   id = ('00000000' + id).slice(-9);
//   let sum = 0, incNum;
//   for (let i = 0; i < 9; i++) {
//       incNum = Number(id[i]) * ((i % 2) + 1);
//       sum += incNum > 9 ? incNum - 9 : incNum;
//   }
//   if (sum % 10 !== 0) { return { valid: false, message: 'ID is not valid.' };
//   }
//   return { valid: true };
// }
// //--------------------------------------------------------------------------------
// function checkForExistingContact(id) {
//   let func_name = "testFindingIDs";         
//   let req_data = {
//     arguments: JSON.stringify({
//       id: id,
//     }),
//   };
//   return ZOHO.CRM.FUNCTIONS.execute(func_name, req_data).then(function(data) {
//     try {
//         if (data.details.output) {
//             let contactDetails = JSON.parse(data.details.output); // Directly parsing the JSON string to an object
//             console.log("Parsed contact details:", contactDetails);

//             // Now you have the contact details object and can compare the Id_No
//             if (contactDetails.Id_No && contactDetails.Id_No === id) {
//                 console.log("Matching ID found:", contactDetails.Id_No);
//                 return contactDetails; // Return the matching contact details
//             } else {
//                 console.log("No matching ID found for:", id);
//                 return null; // Or handle accordingly if no match is found
//             }
//         } else {
//             console.error("No output in data.details to parse:", data.details);
//             return null;
//         }
//     } catch (error) {
//         console.error("Error parsing response from custom function:", error);
//         return null;
//     }
//   }).catch(function(error) {
//       console.error("Error executing custom function:", error);
//       return null;
//   });
// }
// //--------------------------------------------------------------------------------
// function createContactRoleEntry(id, role, fullName) {
//   if (role === "tenant") {
//     role = "דייר פוטנציאלי";
//   } else if (role === "guarantor") {
//     role = "ערב פוטנציאלי";
//   }
//   var contactRoleData = {
//       Entity: 'Contacts_Roles',
//       APIData: {
//           ID_NO: id,
//           Role: role,
//           full_name: fullName,
//       },
//       Trigger: ["workflow", "blueprint"]
//   };
//   console.log("Contact role data:", contactRoleData);
  
//   return ZOHO.CRM.API.insertRecord(contactRoleData)
//       .then(function(response) {
//           console.log("Contact role entry created response:", response);
//           console.log("Contact role entry created response data:", response.data);
//           return response.data;
//       })
//       .catch(function(error) {
//           console.error('An error occurred:', error);
//           throw error;
//       });
// }
// //--------------------------------------------------------------------------------
// function createContactEntry(id, contactInfo) {
//   console.log("entered createContactEntry function");
//   console.log("id:", id);
//   console.log("contactInfo:", contactInfo);
//   var recordData = {
//       Id_No: id,
//       First_Name: contactInfo.firstName,
//       Last_Name: contactInfo.lastName,
//       Mobile: contactInfo.phoneNumber,
//   };
//   console.log("recordData:", recordData);

//   var config = {
//       Entity: "Contacts",
//       APIData: recordData,
//       Trigger: ["workflow", "blueprint"]
//   };
//   console.log("config:", config);

//   console.log("hello");
//   return ZOHO.CRM.API.insertRecord(config)
//       .then(function(response) {
//           console.log("Contact created:", response.data);
//           return response.data;
//       })
//       .catch(function(error) {
//         console.log('An error occurred:', error);
//         if (error.response) {
//             console.error('API response:', error.response.data);
//         }
//       });
// }
// //--------------------------------------------------------------------------------
// function showAdditionalInputFields() {
//   var fieldsHtml = `
//     <div class="input-group"><label for="firstName">First Name:</label><input type="text" id="firstName" name="firstName"></div>
//     <div class="input-group"><label for="lastName">Last Name:</label><input type="text" id="lastName" name="lastName"></div>
//     <div class="input-group"><label for="phoneNumber">Phone Number:</label><input type="text" id="phoneNumber" name="phoneNumber"></div>
//     <button id="additionalSubmit">Submit</button>
//   `;
//   $('#role-selection-form').append(fieldsHtml);
// }
// //--------------------------------------------------------------------------------
// function associateContactRoleWithContact(contactRoleId, contactId) {
//   var config = {
//     Entity: "Contacts_Roles",
//     RecordID: contactRoleId, // try and change RecordID to RecordId or recordId or recordID or id
//     APIData: {
//       "id": contactRoleId,
//       "Contact": contactId
//     },
//     Trigger: ["workflow"] // Add any trigger if needed
//   };

//   return ZOHO.CRM.API.updateRecord(config)
//     .then(function(response) {
//       console.log("Contact Role associated with Contact:", response.data);
//       return response.data; // Return data if needed
//     })
//     .catch(function(error) {
//       console.error("Failed to associate Contact Role with Contact:", error);
//       throw error; // Throw error to handle it outside
//     });
// }
// //--------------------------------------------------------------------------------
// function associateContactRoleWithDeal(contactRoleId, dealId) {
//   ZOHO.CRM.API.updateRecord({
//       Entity: "Contacts_Roles", 
//       RecordID: contactRoleId, // The ID of the Contact Role record you're updating
//       APIData: {
//         "id": contactRoleId, // The ID of the Contact Role record you're updating
//         "Deal": dealId 
//       }
//   }).then(function(response) {
//       console.log("Contact Role associated with Deal:", response.data);
//   }).catch(function(error) {
//       console.error("Failed to associate Contact Role with Deal:", error);
//   });
// }
