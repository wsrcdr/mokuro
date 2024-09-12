async function getData(url){
    try{
        const response = await fetch(url);
        if(!response.ok){
            return null;
        }
        return await response.json();
    }catch(error){
        console.error(error.message);
        return null;
    }
}

async function postData(url, body){
    try{
        await fetch(url, {method: "POST", headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }, body: JSON.stringify(body)});
        return null;
    }catch(error){
        console.error(error.message);
        return null;
    }
}

class MangaEngineStorage {
    constructor(manga_id){
        this.manga_id = manga_id;
        this.save_url = `http://localhost:5000/manga/${manga_id}/mokuro/save`;
    }

    async keys(){
        let v = await getData(this.save_url);
        return v['keys'];
    }

    async getItem(key){
        let v = await getData(this.save_url+"/"+key);
        return v['value'];
    }

    async removeItem(key){
        await fetch(this.save_url+"/"+key, {method: "DELETE"});
        return null;
    }

    async setItem(key, value){
        await postData(this.save_url, {key: key, value: value});
        return null;
    }
}

class CustomStorage {
    constructor(manga_id){
        this.storage = localforage;
        if(window.location.hostname == "localhost"){
            this.storage = new MangaEngineStorage(manga_id);
        }
    }

    async keys(){
        return await this.storage.keys();
    }

    async getItem(key){
        return await this.storage.getItem(key);
    }

    async removeItem(key){
        await this.storage.removeItem(key);
    }

    async setItem(key, value){
        await this.storage.setItem(key, value);
    }
}