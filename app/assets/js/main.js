ZOHO.embeddedApp.on("PageLoad", function (data) {
  console.log(data);
  console.log(data.EntityId);
  console.log(data.Entity);
  let entityId = data.EntityId;
  let entityName = data.Entity;

  ZOHO.CRM.UI.Resize({ height: "600", width: "800" });
    ZOHO.CRM.API.getRecord({
      Entity: entityName,
      approved: "both",
      RecordID: entityId,
    }).then(function (entityData) {
      console.log(entityData.data);
      let entityDetail = entityData.data[0];
      //
      LoadWidget(entityDetail);

      $("#selectButton").click(function () {
        Submit(entityDetail);
      });

      $("#cancelButton").click(function () {
        ZOHO.CRM.UI.Popup.close();
      });
    }).catch(function(error) {
      console.error('An error occurred:', error);
    });
  });


ZOHO.embeddedApp.init();

$(document).ready(function() {
  // Ensure only one checkbox can be selected at a time
  $('input[type="checkbox"][name="role"]').on('change', function() {
      $('input[type="checkbox"][name="role"]').not(this).prop('checked', false);
  });

  // Handle the confirm button click with validation
  $('#confirmButton').on('click', function() {
      var selectedRole = $('input[type="checkbox"][name="role"]:checked').val();
      var idInput = $('#idInput').val().trim();

      // Perform basic validation
      if (!selectedRole) {
          swal('Error', 'Please select a role.', 'error');
          return;
      }
      var idValidationResult = isValidId(idInput);
      if (!idInput || !idValidationResult.valid) {
          swal('Error', idValidationResult.message || 'Please enter an ID.', 'error');
          return;
      }

      checkForExistingContact(idInput)
      .then(function(response) {
        if (response.data.length > 0) {
          console.log("Existing contact found:", response.data[0]);
            // If contact exists, proceed with role creation and association
            let contact = response.data[0];
            // Create Contact Role entry and associate it
            createContactRoleEntry(contact.id, selectedRole).then(function(crResponse) {
              let contactRoleId = crResponse.data[0].details.id;
              associateContactRoleWithContact(contactRoleId, contact.id);
              associateContactRoleWithDeal(contactRoleId, entityId);
            });
        } else {
            console.log("Entered the else because no contact was found.");
            // No contact found logic here, including showing additional fields
            showAdditionalInputFields();
            $('#additionalSubmit').on('click', function() { // Ensure not to bind multiple times
              var firstName = $('#firstName').val().trim();
              var lastName = $('#lastName').val().trim();
              var phoneNumber = $('#phoneNumber').val().trim();
              
              if (!firstName || !lastName || !phoneNumber) {
                  swal('Error', 'Please provide the full contact details.', 'error');
                  return;
              }
              
              createContactEntry({firstName, lastName, phoneNumber, idInput}).then(function(newContactResponse) {
                let newContactId = newContactResponse.data[0].details.id;
                createContactRoleEntry(newContactId, selectedRole).then(function(newCrResponse) {
                  let newContactRoleId = newCrResponse.data[0].details.id;
                  associateContactRoleWithContact(newContactRoleId, newContactId);
                  associateContactRoleWithDeal(newContactRoleId, entityId);
                });
              });
          });
      }
      })
      .catch(function(error) {
          console.error('An error occurred:', error);
      });

      console.log("Selected role:", selectedRole, "ID:", idInput);
  });

  // Optionally handle the cancel button click for custom behavior
  $('#cancelButton').on('click', function() {
      ZOHO.CRM.UI.Popup.close().then(function() {
          console.log("Popup closed");
      });
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
// function checkForExistingContact(id) {
//   return ZOHO.CRM.API.searchRecords({
//       Entity: 'Contacts',
//       Type: 'criteria',
//       Criteria: `Id_No:equals:${id}`, 
//   });
// }
// function checkForExistingContact(id) {
//   // Assuming `Id_No` is the field you're searching by.
//   // This approach uses getRecords with a query parameter as a workaround.
//   return ZOHO.CRM.API.getRecords({
//       Entity: 'Contacts',
//       // Use a query parameter to filter by Id_No. Adjust the field name as necessary.
//       params: {
//           "criteria": `(Id_No:equals:${id})`
//       }
//   }).then(function(response) {
//       console.log("Filtered search results:", response.data);
//       return response; // Return the response for further use
//   }).catch(function(error) {
//       console.error("Error during getRecords for contact check:", error);
//   });
// }
// function checkForExistingContact(id) {
//   return findContactByIdNo(id);
// }
function checkForExistingContact(id) {
  return findContactByIdNo(id).then(foundContact => {
      if (foundContact) {
          console.log('Found matching contact:', foundContact);
          // Do something with foundContact
          return foundContact; // You can process or return the found contact here
      } else {
          console.log('No contact found with the given Id_No.');
          return null; // Or handle the "not found" case
      }
  });
}

// function fetchAllContacts() {
//   return ZOHO.CRM.API.getAllRecords({Entity:"Contacts"})
//       .then(function(response) {
//           return response.data; // Assuming the data is directly accessible
//       })
//       .catch(function(error) {
//           console.error('Error fetching contacts:', error);
//           return [];
//       });
// }
function fetchAllContacts() {
  let page = 1;
  const perPage = 200; // Adjust based on API limits
  let allContacts = [];

  function fetchPage() {
      return ZOHO.CRM.API.getAllRecords({
          Entity: "Contacts",
          page: page,
          per_page: perPage
      }).then(response => {
          const contacts = response.data || [];
          allContacts = allContacts.concat(contacts);
          if (contacts.length === perPage) {
              page++;
              return fetchPage(); // Recursively fetch next page
          } else {
              return allContacts; // All pages have been fetched
          }
      }).catch(error => {
          console.error('Error fetching contacts:', error);
          return []; // Return an empty array on error
      });
  }

  return fetchPage();
}


// function findContactByIdNo(idNoInput) {
//   fetchAllContacts().then(contacts => {
//       const foundContact = contacts.find(contact => contact['Id_No'] === idNoInput);
//       if(foundContact) {
//           console.log('Found matching contact:', foundContact);
//           // Process the found contact as needed
//       } else {
//           console.log('No contact found with the given Id_No.');
//       }
//   });
// }
function findContactByIdNo(idNoInput) {
  return fetchAllContacts().then(contacts => {
      return contacts.find(contact => contact['Id_No'] === idNoInput) || null;
  });
}


//--------------------------------------------------------------------------------
function createContactRoleEntry(id, role, fullName) {
  var contactRoleData = {
      Entity: 'Contacts_Roles',
      data: {
          Role: role,
          ID_NO: id,
          full_name: fullName,
      },
  };
  ZOHO.CRM.API.insertRecord(contactRoleData).then(function(response) {
      console.log("Contact role entry created:", response.data);
      ZOHO.CRM.UI.Popup.close().then(function() {
          console.log("Popup closed");
      });
  }).catch(function(error) {
      console.error('An error occurred:', error);
  });
}


//--------------------------------------------------------------------------------
function createContactEntry(id, contactInfo) {
  var contactData = {
      Entity: 'Contacts',
      data: {
          Id_No: id,
          First_Name: contactInfo.firstName,
          Last_Name: contactInfo.lastName,
          Mobile: contactInfo.phoneNumber,
      },
  };
  ZOHO.CRM.API.insertRecord(contactData).then(function(response) {
      console.log("Contact created:", response.data);
  }).catch(function(error) {
      console.error('An error occurred:', error);
  });
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
function associateContactRoleWithContact(contactRoleId, contactId) {
  ZOHO.CRM.API.updateRecord({
      Entity: "Contacts_Roles", 
      RecordID: contactRoleId, // The ID of the Contact Role record you're updating
      APIData: {
          "Contact": contactId 
      }
  }).then(function(response) {
      console.log("Contact Role associated with Contact:", response.data);
  }).catch(function(error) {
      console.error("Failed to associate Contact Role with Contact:", error);
  });
}


//--------------------------------------------------------------------------------
function associateContactRoleWithDeal(contactRoleId, dealId) {
  ZOHO.CRM.API.updateRecord({
      Entity: "Contacts_Roles", 
      RecordID: contactRoleId, // The ID of the Contact Role record you're updating
      APIData: {
          "Deal": dealId 
      }
  }).then(function(response) {
      console.log("Contact Role associated with Deal:", response.data);
  }).catch(function(error) {
      console.error("Failed to associate Contact Role with Deal:", error);
  });
}
