const puppeteer = require('puppeteer');
const utils = require("./utils/utils.js");
const fs = require("fs");
const express = require('express')
const app = express()
const bodyParser = require('body-parser')
const path = require('path');
app.use(express.static('public'));
app.use(bodyParser.urlencoded())

app.use(bodyParser.json());



app.get('/', (req, res) => {
	res.sendFile(path.join(__dirname + '/index.html'));
});

app.get('/createBot', async (req, res) => {
    const botId = await initBot();
	res.status(200).send({
        id: botId
    })
});

app.get('/getQR/:id', async (req, res) => {
    const id = parseInt(req.params.id);
    const qrCode = await getQR(id);
    if(qrCode == null){
        res.status(401).send({
            error: true,
            message: "Already logged"
        });
    }else{
		res.writeHead(200, {
			'Content-Type': 'image/png',
			'Content-Length': qrCode.length
		});
		res.end(qrCode);
    }
});

app.get('/bot/:id/status', async (req, res) => {
    const id = parseInt(req.params.id);
	res.status(200).send({status:bots[id].status});
});

app.get('/bot/:id/exportChat/:name', async (req, res) => {
    const id = parseInt(req.params.id);
    if(bots[id].status != "Free"){
        res.status(401).send({error:true, message:"Bot already using"});
    }else{
        bots[id].status = "Exporting chat";
        res.status(200).send({error:false, message:"Exporting start..."});
        backupChat(id, req.params.name);
    }
	
});

app.get('/bot/:id/exportPictures/:name', async (req, res) => {
    const id = parseInt(req.params.id);
    if(bots[id].status != "Free"){
        res.status(401).send({error:true, message:"Bot already using"});
    }else{
        bots[id].status = "Exporting pictures";
        res.status(200).send({error:false, message:"Exporting start..."});
        backupPictures (id, req.params.name);
    }
	
});

app.get('/bot/:id/getChats', async (req, res) => {
    const id = parseInt(req.params.id);
    if(bots[id].status != "Free"){
        res.status(401).send({error:true, message:"Bot already using"});
    }else{
        bots[id].status = "Getting chats";
        const chat = await getChats(id, req.params.name);
        res.status(200).send({error:false, chats:chat});
        bots[id].status = "Free";
    }
	
});

app.post('/bot/:id/createGroup', async (req, res) => {
    const id = parseInt(req.params.id);
    if(bots[id].status != "Free"){
        res.status(401).send({error:true, message:"Bot already using"});
    }else{
        bots[id].status = "Creating group";
		console.log('create bot => ', req.body);
        const group = await createGroup(id, req.body);
        res.status(200).send({error:false, message:group});
        bots[id].status = "Free";
    }
	
});

app.post('/bot/:id/reload', async (req, res) => {
    const id = parseInt(req.params.id);
    const reloaded = await reloadBot(id);
    res.status(200).send({error:false, message:"Bot reloaded succefully!"});
});

app.post('/bot/:id/sendMessage', async (req, res) => {
    const id = parseInt(req.params.id);
    const reloaded = await sendMessage(id, req.body);
    res.status(200).send({error:false, message:"Bot reloaded succefully!"});
}); 

app.get('/bot/:id/readChatsMessage', async (req, res) => {
    const id = parseInt(req.params.id);
    const messages = await readChatsMessage(id);
    res.status(200).send({error:false, result:messages});
}); 

// readChatsMessage

app.listen(9000);

const filePath = "./backups/";

const bots = [];

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

autoScroll = async (page) => {
    return await page.evaluate(async () => {
        return await new Promise(resolve => {            
            const scrollInterval = setInterval(() => {
                console.log("[+] Subindo a conversa...");
                
                const scrollNow = document.getElementsByClassName('_2-aNW')[0].scrollTop;
                console.log("[!] Scroll: " + scrollNow);
                if(document.getElementsByClassName('_2n04H').length > 0){
                    resolve(document.getElementsByClassName('_3sKvP'));
                    clearInterval(scrollInterval);
                }else{
                    document.getElementsByClassName('_2-aNW')[0].scrollTop = 0;
                }
            }, 500);
        });
    });
}

successFunc = async(page) => {
    console.log('fim');
}

exportChat = (id, name, chat) => {
    const messages = [];
    for(dialog of chat){
        messages.push(dialog.who + dialog.msg);
    }

    const time = new Date().getTime();
    const path = "backups/" + id + "/" + name.replace(" ❤️", "") + '/';
    const filename = path + name + "_" + time;
    fs.writeFileSync( filename + '.txt', messages.join('\n') );
    fs.writeFileSync( filename + '.json', JSON.stringify(chat) );
    console.log("[+] BACKUP FEITO COM SUCESSO!");
}

backupChat = async (id, chat) => {
    fs.mkdir("backups/" + id + '/' + chat.replace(" ❤️", ""), {recursive: true}, err => {});
    console.log("[+] Iniciando o backup da conversa " + chat);
    const page = bots[id].page;
    const selector = "span [title*='"+chat+"']";
    await page.waitForSelector(selector);
    const spanChat = await page.$(selector);

    console.log("selector => ", spanChat);

    await spanChat.click();

    autoScroll(page, successFunc).then(async (response) => {
        const backup = await page.evaluate(async () => {
            return await new Promise(resolve => {
                const dialogs = document.getElementsByClassName('_3sKvP');
                const backup = [];
                for(dialog of dialogs){
                    if(dialog.children[1].children.length > 0){
                        if(dialog.children[1].children[0].dataset.prePlainText != undefined){
                            const who = dialog.children[1].children[0].dataset.prePlainText;
                            const msg = dialog.children[1].children[0].textContent;
                            backup.push({
                                who: who,
                                msg:msg
                            });
                        }
                    }
                }
                console.log(backup);
                resolve(backup);
            });
        });

        console.log("aaaaa", backup);
        bots[id].status = "Free";
        exportChat(id, chat, backup);
    });

}

getChats = async (id) => {
    const page = bots[id].page;
    return await page.evaluate(() => {
        const chatElements = document.querySelectorAll('._357i8');
        const chats = [];
        for(var chat of chatElements){
            chats.push(chat.textContent);
        }

        return chats;
    });
}



backupPictures = async (id, chat) => {
    const page = bots[id].page;
    const browser = bots[id].browser;
    fs.mkdir("backups/" + id + '/' + chat.replace(" ❤️", "") + "/midia", {recursive: true}, err => {});
    console.log("[+] Iniciando o backup da conversa " + chat);
    var selector = "span [title='"+chat+"']";
    await page.waitForSelector(selector);
    var clickElement = await page.$(selector);

    await clickElement.click();
    selector = "#main > header > div._33QME"
    await page.waitForSelector(selector);

    clickElement = await page.$(selector);

    await clickElement.click();

    selector = "#app > div > div > div.YD4Yw > div._1-iDe._14VS3 > span > div > span > div > div > div.Mr-fu > div._2Bps4._1mTqm._1q6Ey > div._1Gecv > div > div > div.sb_Co"
    await page.waitForSelector(selector);

    clickElement = await page.$(selector);

    await clickElement.click();

    selector = '#app > div > div > div.YD4Yw > div._1-iDe._14VS3 > span > div > span > div > div._2wPpw > span > div > div > div > div:nth-child(1) > div._2n28r > div';
    await page.waitForSelector(selector);

    clickElement = await page.$(selector);
    
    clickElement.click();


    const imgSelector = "img._8Yseo._3W6yC._3Whw5";
    const nextButtonSelector = "#app > div > span:nth-child(3) > div > div > div.overlay._2kf8f > div._3QYia > div._2Xk42 > div > span";
    await page.waitForSelector(imgSelector);

    const pageAux = await browser.newPage();

    var nextButton = await page.$(nextButtonSelector);
    var i = 0;
    var tryDown = 0;
    var waitLoad = 0;
    var lastImg = "";
    while(nextButton != null){
        try{
            await sleep(500);
            const filename = i + '_' + new Date().getTime() + '.jpg';
            
            // await utils.sreenshotElement(page, {
            //     path: filename,
            //     selector: imgSelector,
            //     padding: 0
            // });
            const img = await page.$(imgSelector);
            const path = "backups/" + id + '/' + chat.replace(" ❤️", "") + "/midia/";
            if(img != null){
                const imgSrc = await page.$eval(imgSelector, img => img.getAttribute('src'));
                if(imgSrc != lastImg){
                    lastImg = imgSrc;
                    console.log("downloading img: ", imgSrc);
                    const response = await pageAux.goto(imgSrc);
                    const buffer = await response.buffer();
                    fs.writeFileSync(path + filename, buffer);
                    i += 1;
                    nextButton.click();
                    
                }
            }else{
                const downBtn = await page.$('._1o34e');
                console.log(downBtn);
                if(downBtn != null){
                    if(tryDown >= 3){
                        tryDown = 0;
                        nextButton.click();
                    }else{
                        downBtn.click();
                        tryDown += 1;
                    }

                }else{
                    if(waitLoad < 5){
                        waitLoad += 1;
                        sleep(500);
                    }else{
                        waitLoad = 0;
                        nextButton.click();
                    }
                }
            }
        }catch(err){
            continue;
        }
        nextButton = await page.$(nextButtonSelector);
    }
    bots[id].status = "Free";
    console.log("Finalizado");
    pageAux.close();

}

createGroup = async(id, opts) => {
	const page = bots[id].page;
	
	var menu = await page.$("#side > header > div._3euVJ > div > span > div:nth-child(3) > div > span");
	
	await menu.click();
	
	menu = await page.$('.Ut_N0.n-CQr');
	
	menu.click();
	
	await page.waitForSelector('._17ePo.copyable-text.selectable-text');
	
	
	var clickElement;
	
	
	
	await page.focus('._17ePo.copyable-text.selectable-text');
	if(opts.contact != undefined){
		await page.type('._17ePo.copyable-text.selectable-text', opts.contact);
		//await page.keyboard.type(opts.contact);
		clickElement = await page.$('._3CneP');
		await clickElement.click();
	}else{
		clickElement = await page.$('._3CneP');
		await clickElement.click();
	}
	
	await page.waitForSelector('._3y5oW');
	
	clickElement = await page.$('._3y5oW');
	await clickElement.click();
	
	await page.waitForSelector('._2FVVk._3WjMU');
	
	clickElement = await page.$('._2FVVk._3WjMU');
	
	
	//await page.type('._17ePo.copyable-text.selectable-text', opts.name);
 
	
	
	
	const fileInput = await page.$('input[type=file]');
	await fileInput.uploadFile('./qrCode/1595533741709.jpg');
	
	await page.waitForSelector('._3y5oW._3qMYG');
	clickElement = await page.$('._3y5oW._3qMYG');
	
	await clickElement.click();
	await page.keyboard.type(opts.name);
		
	await page.waitForSelector('._3y5oW');
		
	await page.evaluate(()=> {
        document.getElementsByClassName('_3y5oW')[0].click();
        document.querySelector("._3y5oW").click();
    });
		
	return "Group created sucefully!";
	
}

reloadBot = async (id) => {
    await bots[id].browser.close();
    bots[id].browser = undefined;
    bots[id].status = "";
    bots[id].page = undefined;

    const browser = await puppeteer.launch({headless: false});
    const page = await browser.newPage();
    await page.goto("https://web.whatsapp.com/");
    bots[id] = {
        browser:browser,
        page:page,
        status:'Waiting login'
    };

    return true;
}

getQR = async (id) => {
    if(bots[id].status != "Waiting login"){
        return null;
    }
    const page = bots[id].page;
    const btnWait = await page.$('._3IKPF');
    if(btnWait != null){
        btnWait.click();
        await sleep(2000);
    }
	
    const qr = await utils.sreenshotElement(page, {
        selector: utils.QR_SELECTOR,
        padding: 16
    });

    if(bots[id].waitLogin != undefined){ clearInterval(bots[id].waitLogin); }

    bots[id].waitLogin = setInterval(async () => {
        const qr = await page.$(utils.QR_SELECTOR);
        if(qr == null){ clearInterval(bots[id].waitLogin);bots[id].status = "Free"; }
        console.log(qr);
    }, 1000);

    return qr;
}

searchContact = async (id, contact) => {
    const page = bots[id].page;
    var clickElement;

    clickElement = await page.$('._2FVVk.cBxw-');

    await clickElement.click();

    await page.keyboard.type(contact);

    await page.waitForSelector('._3ko75');

    

    const contact_r = await page.$("span[title*='" + contact + "']._3ko75");

    console.log("contact_r", contact_r);

    if(contact_r != null){ await contact_r.click(); }

    clickElement = await page.$('._3e4VU');
    await clickElement.click();

    return contact_r;
}

sendMessage = async (id, opts) => {
    const contact = opts.contact;
    const message = opts.message;
    const page = bots[id].page;
    var clickElement;

    const clickContact = await searchContact(id, contact.name);

    if(clickContact == null){
        const clickContact = await searchContact(id, contact.number);
        if(clickContact == null){
            const sendLink = "https://web.whatsapp.com/send?phone=" + contact.number + "&text&source&data&app_absent";
            await page.goto(sendLink);
        }
    }

    await page.waitForSelector('._2FVVk._2UL8j');

    clickElement = await page.$('._2FVVk._2UL8j');
    await clickElement.click();
    await page.keyboard.type(message);

    clickElement = await page.$('._1U1xa');
    clickElement.click();

    return "Send Succeffully!";


}

getTotalUnreadMessages = (text) => {
    return text.split(" ")[0];
}

readChatsMessage = async (id) => {
    const page = bots[id].page;
    //const count = await page.$eval('._31gEB', img => img.getAttribute('innerText'));

    //const chats = page.$$('._31gEB');

    const chat = await page.$('._31gEB');
    let value = await page.evaluate(el => el.textContent, chat);

    await chat.click();

    console.log('count => ', value);

    await page.waitForSelector('._274yw');

    const messages = await page.evaluate(async () => {
        return await new Promise(resolve => {
            const dialogs = document.getElementsByClassName('_274yw');
            const backup = [];
            for(dialog of dialogs){
                if(dialog.children.length > 0){
                    if(dialog.children[0].textContent != undefined){
                        const who = dialog.children[0].getAttribute('data-pre-plain-text');
                        const msg = dialog.children[0].textContent;
                        backup.push({
                            who: who,
                            msg: msg
                        });
                    }
                }
            }
            console.log(backup);
            resolve(backup);
        });
    });

    const retorno = messages.slice(0 - parseInt(value));

    return retorno;
}

initBot = async () => {
    const browser = await puppeteer.launch({headless: false, userDataDir: "./user_data/" + bots.length});
    const page = await browser.newPage();
    await page.goto("https://web.whatsapp.com/");
    bots.push({
        browser:browser,
        page:page,
        status:'Free'
    });

    return bots.length - 1;
};

