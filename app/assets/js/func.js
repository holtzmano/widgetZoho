function LoadWidget(entity) {
  console.log("LoadWidget for Entity", entity);
  ZOHO.CRM.API.getRelatedRecords({Entity:"Deals",RecordID:entity.id,RelatedList:"Contacts_Roles", page:1, per_page:200})
  .then(function(data){
    console.log("Contacts_Roles", data.data);
    const tbody = $("#contacts-tbody");
    data.data.forEach(contact => {
      const tr = $("<tr>");
      tr.append($("<td>").text(contact.Role));
      tr.append($("<td>").text(contact.full_name));
      tr.append($("<td>").text(contact.ID_NO));
      tbody.append(tr);
    })
  });
}

ZOHO.embeddedApp.on("PageLoad", function (data) {
  console.log(data);
  console.log(data.EntityId);
  console.log(data.Entity);
  LoadWidget(data.entity);
});

ZOHO.embeddedApp.init();

