$(document).ready(function() {
  $('#accDetailDiv').hide()
  document.getElementById('stats').innerHTML = '';
  document.getElementById('amountInvested').innerHTML = ''
  document.getElementById('accountNo').innerHTML = ''
  document.getElementById('totalPortfolioValue').innerHTML = ''

  $("#resultBtnId").click(function() {
    $('#dataTable').DataTable().destroy()
    $('#accDetailDiv').hide()

    account = $.trim($('#accountId').val())
    stock = $.trim($('#stockId').val())
    url = '/transactions?'
    if(account != '' && account != 'undefined'){
      url = url + 'account='+account+'&'
    }
    if(stock != '' && stock != 'undefined'){
      url = url + 'stock='+stock
    }

    table = $('#dataTable').DataTable({
        retrieve: true,
        sort: true,
       // scrollY: 400,
        ajax: {
            'url': url
        },
      columns: [
        { data: 'accountNo' },
       // { data: 'accHolderName' },
        { data: 'ticker' },
        { data: 'date', render: function (data, type, row, meta) {
                return moment.unix(data).format('DD/MM/YYYY h:mm');
            }},
        { data: 'price', render: function (data, type, row, meta) {
                return Number(data/100).toFixed(2);
            }},
        { data: 'quantity' },
        { data: 'lotValue', render: function (data, type, row, meta) {
                return Number(data/100).toFixed(2);
            }}
      ]
    });

   if(account != '' && account != 'undefined' && account.length > 7){
      $('#accDetailDiv').show()
      $.ajax({
          url : "/accountstats?account="+account,
          success: function(response){
            res = $.parseJSON(response)
            console.log(res);
            amountInvested = res['amountInvested']
            stats = res['stats']
            totalPortfolioValue = res['totalPortfolioValue']

            document.getElementById('stats').innerHTML = '';
            for (const stock in stats) {
                console.log('Stock: ${stock}');

                const row = document.createElement('tr');
                row.innerHTML = `
                    <td style='background-color: #97dcbf; padding: 5px;background-clip: padding-box;border: 3px solid transparent; border-radius: 6px;'>${stock}</td>
                    <th>&nbsp;&nbsp;</th>
                    <td >${stats[stock]['quantity']}</td>
                    <th>&nbsp;&nbsp;</th>
                    <td >${stats[stock]['avgCostPrice']}</td>
                    <th>&nbsp;&nbsp;</th>
                    <td >${stats[stock]['totalStockCost']}</td>
                    <th>&nbsp;&nbsp;</th>
                    <td >${stats[stock]['stockValue']}</td>
                `;
                document.getElementById('stats').appendChild(row);
            }

            document.getElementById('amountInvested').innerHTML = amountInvested
            document.getElementById('totalPortfolioValue').innerHTML = totalPortfolioValue
            document.getElementById('accountNo').innerHTML = account

          },
          error: function(error){
            console.log(error);
          }
      });
    }

 });

 $("#chatAI").click(function(){
        $('#chatAIContainer').modal()
   });

});

$.extend( $.fn.dataTable.defaults, {
    searching: false,
    ordering:  false
});
